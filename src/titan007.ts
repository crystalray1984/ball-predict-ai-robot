import dayjs from 'dayjs'
import { InferAttributes, Op, QueryTypes } from 'sequelize'
import { getOddResult, isNullOrUndefined } from './common/helpers'
import { RateLimiter } from './common/rate-limiter'
import { db, Match, PromotedOdd, Team, Titan007Odd, VMatch } from './db'
import {
    findMatch,
    getFinalMatches,
    getMatchOdd,
    getMatchScore,
    getTodayMatches,
} from './titan007/index'

/**
 * 处理球探网的比赛数据，将球探网的数据与本地的皇冠数据连接起来
 */
async function processMatches() {
    const limit = new RateLimiter(600000)
    while (true) {
        await limit.next()

        try {
            const matches = await getTodayMatches()
            if (matches.length === 0) continue

            const { min_time, max_time } = matches.reduce<{
                min_time: number
                max_time: number
            }>(
                ({ min_time, max_time }, row) => ({
                    min_time: Math.min(min_time, row.match_time),
                    max_time: Math.max(max_time, row.match_time),
                }),
                {
                    min_time: Number.MAX_SAFE_INTEGER,
                    max_time: 0,
                },
            )

            //读取比赛数据
            const raw_matches = await VMatch.findAll({
                where: {
                    match_time: {
                        [Op.between]: [new Date(min_time), new Date(max_time)],
                    },
                    titan007_match_id: '',
                },
            })

            if (raw_matches.length === 0) continue

            for (const match of raw_matches) {
                const found = findMatch(match, matches)
                if (!found) {
                    continue
                }

                //找到了匹配的，更新数据
                if (!found.swap) {
                    //正常的数据
                    await Match.update(
                        {
                            titan007_match_id: found.match_id,
                        },
                        {
                            where: {
                                id: match.id,
                            },
                        },
                    )

                    if (!match.team1_titan007_id) {
                        //主队数据
                        await Team.update(
                            {
                                titan007_team_id: found.team1_id,
                            },
                            {
                                where: {
                                    id: match.team1_id,
                                },
                            },
                        )
                    }

                    if (!match.team2_titan007_id) {
                        //客队数据
                        await Team.update(
                            {
                                titan007_team_id: found.team2_id,
                            },
                            {
                                where: {
                                    id: match.team2_id,
                                },
                            },
                        )
                    }
                } else {
                    //主客场交换的数据
                    await Match.update(
                        {
                            titan007_match_id: `-${found.match_id}`,
                        },
                        {
                            where: {
                                id: match.id,
                            },
                        },
                    )

                    if (!match.team1_titan007_id) {
                        //主队数据
                        await Team.update(
                            {
                                titan007_team_id: found.team2_id,
                            },
                            {
                                where: {
                                    id: match.team1_id,
                                },
                            },
                        )
                    }

                    if (!match.team2_titan007_id) {
                        //客队数据
                        await Team.update(
                            {
                                titan007_team_id: found.team1_id,
                            },
                            {
                                where: {
                                    id: match.team2_id,
                                },
                            },
                        )
                    }
                }
            }

            console.log('球探网比赛数据处理完成')
        } catch (err) {
            console.error(err)
        }
    }
}

/**
 * 处理球探网的盘口数据
 */
async function processOdds() {
    const limiter = new RateLimiter(60000)
    while (true) {
        await limiter.next()

        try {
            //读取距离开赛30分钟内，且列入“准备中”的比赛
            const matchIds = await db.query<{ id: number }>(
                {
                    query: `
                SELECT
                    DISTINCT
                    \`match\`.id
                FROM
                    odd
                INNER JOIN
                    \`match\` ON \`match\`.id = odd.match_id
                WHERE
                    odd.status = ?
                    AND \`match\`.match_time >= ?
                    AND \`match\`.match_time < ?
                    AND \`match\`.status = ?
                    AND \'match\`.titan007_match_id != ?
                `,
                    values: ['ready', new Date(), new Date(Date.now() + 1800000), '', ''],
                },
                {
                    type: QueryTypes.SELECT,
                },
            )

            if (matchIds.length === 0) continue

            const matches = await Match.findAll({
                where: {
                    id: {
                        [Op.in]: matchIds.map((t) => t.id),
                    },
                },
            })

            for (const match of matches) {
                try {
                    const result = await getMatchOdd(match.titan007_match_id)
                    let odd = await Titan007Odd.findOne({
                        where: {
                            match_id: match.id,
                        },
                    })
                    if (odd) {
                        //记录已存在就只是更新
                        if (result.ah) {
                            odd.ah_end = result.ah.end
                            if (isNullOrUndefined(odd.ah_start)) {
                                odd.ah_start = result.ah.start
                            }
                        }
                        if (result.ah_period1) {
                            odd.ah_period1_end = result.ah_period1.end
                            if (isNullOrUndefined(odd.ah_period1_start)) {
                                odd.ah_period1_start = result.ah_period1.start
                            }
                        }
                        if (result.goal) {
                            odd.goal_end = result.goal.end
                            if (isNullOrUndefined(odd.goal_start)) {
                                odd.goal_start = result.goal.start
                            }
                        }
                        if (result.goal_period1) {
                            odd.goal_period1_end = result.goal_period1.end
                            if (isNullOrUndefined(odd.goal_period1_start)) {
                                odd.goal_period1_start = result.goal_period1.start
                            }
                        }
                        if (result.corner) {
                            if (result.corner.ah) {
                                odd.corner_ah_end = result.corner.ah.end
                                if (isNullOrUndefined(odd.corner_ah_start)) {
                                    odd.corner_ah_start = result.corner.ah.start
                                }
                            }
                            if (result.corner.goal) {
                                odd.corner_goal_end = result.corner.goal.end
                                if (isNullOrUndefined(odd.corner_goal_start)) {
                                    odd.corner_goal_start = result.corner.goal.start
                                }
                            }
                        }
                        await odd.save()
                    } else {
                        //添加记录
                        await Titan007Odd.create({
                            match_id: match.id,
                            ah_start: result.ah?.start ?? null,
                            ah_end: result.ah?.end ?? null,
                            ah_period1_start: result.ah_period1?.start ?? null,
                            ah_period1_end: result.ah_period1?.end ?? null,
                            goal_start: result.goal?.start ?? null,
                            goal_end: result.goal?.end ?? null,
                            goal_period1_start: result.goal_period1?.start ?? null,
                            goal_period1_end: result.goal_period1?.end ?? null,
                            corner_ah_start: result.corner?.ah?.start ?? null,
                            corner_ah_end: result.corner?.ah?.end ?? null,
                            corner_goal_start: result.corner?.goal?.start ?? null,
                            corner_goal_end: result.corner?.goal?.end ?? null,
                        })
                    }
                } catch (err) {
                    console.error(err)
                }
            }
        } catch (err) {
            console.error(err)
        }
    }
}

/**
 * 处理球探网赛果数据
 */
async function processScore() {
    const limiter = new RateLimiter(120000)
    while (true) {
        await limiter.next()
        try {
            //读取需要计算赛果的比赛
            let matches = await db.query(
                {
                    query: `
                    SELECT
                        *
                    FROM
                        v_match
                    WHERE
                        id IN
                        (
                        SELECT
                            DISTINCT
                            a.id
                        FROM
                            \`match\` AS a
                        LEFT JOIN
                            odd ON odd.match_id = a.id
                        LEFT JOIN
                            promoted_odd ON promoted_odd.match_id = a.id
                        WHERE
                            NOT(odd.id IS NULL)
                            AND NOT(promoted_odd.id IS NULL)
                            AND a.match_time <= ?
                            AND a.match_time >= ?
                        )
                    WHERE
                        has_score = 0
                        AND error_status = ''
                    `,
                    values: [new Date(Date.now() - 450000), new Date(Date.now() - 86400000)],
                },
                {
                    type: QueryTypes.SELECT,
                    model: VMatch,
                },
            )

            //对赛事数据进行筛选
            matches = matches.filter((match) => {
                //距离开赛不足105分钟且已经有半场赛果的比赛跳过
                if (
                    Date.now() - match.match_time.valueOf() <= 105 * 60000 &&
                    match.has_period1_score
                ) {
                    return false
                }

                return true
            })

            console.log('需要获取赛果的比赛', matches.length)
            if (matches.length === 0) return

            //读取球探网的今日比赛
            let titan007_matches = await getTodayMatches()
            //如果待读取赛果的比赛中，有超过球探网数据的，那么继续往前找
            const minTime1 = Math.min(...titan007_matches.map((t) => t.match_time))
            const minTime2 = Math.min(...matches.map((t) => t.match_time.valueOf()))
            if (minTime2 < minTime1) {
                //读取昨日完场赛果
                titan007_matches = (
                    await getFinalMatches(dayjs().startOf('day').subtract(1, 'day'))
                ).concat(titan007_matches)
            }

            for (const match of matches) {
                let titan007_match_id = match.titan007_match_id

                if (!titan007_match_id) {
                    //如果还没有赛事id，那么就去匹配赛事id
                    const found = findMatch(match, titan007_matches)
                    if (!found) {
                        //没找到对应的赛果
                        continue
                    }

                    titan007_match_id = found.match_id

                    //这时可以更新比赛的信息，供后续使用
                    await Match.update(
                        {
                            titan007_match_id,
                        },
                        {
                            where: {
                                id: match.id,
                            },
                            returning: false,
                        },
                    )

                    //更新球队信息
                    if (found.team1_id && !match.team1_titan007_id) {
                        await Team.update(
                            {
                                titan007_team_id: found.team1_id,
                            },
                            {
                                where: {
                                    id: match.team1_id,
                                },
                                returning: false,
                            },
                        )
                    }
                    if (found.team2_id && !match.team2_titan007_id) {
                        await Team.update(
                            {
                                titan007_team_id: found.team2_id,
                            },
                            {
                                where: {
                                    id: match.team2_id,
                                },
                                returning: false,
                            },
                        )
                    }
                }

                //如果已经有了赛事id，那么只需要判断这个赛事的状态
                const match_row = titan007_matches.find((t) => t.match_id === titan007_match_id)
                if (!match_row) continue

                //如果已经有了半场比分，但是这场比赛尚未完场，那也不处理
                if (match.has_period1_score && match_row.state !== -1) continue

                //如果比赛连半场也没结束，那也不处理
                if (match_row.state !== -1 && match_row.state < 2) continue

                //读取赛果
                let result: Titan007.MatchScore
                try {
                    result = await getMatchScore(titan007_match_id)
                } catch (err) {
                    console.error(err)
                    continue
                }

                //根据match_row的状态来觉得应该更新什么属性
                const updated: Partial<InferAttributes<Match>> = {}
                if (!match.has_period1_score) {
                    updated.score1_period1 = result.score1_period1
                    updated.score2_period1 = result.score2_period1
                    updated.corner1_period1 = result.corner1_period1
                    updated.corner2_period1 = result.corner2_period1
                    updated.has_period1_score = 1
                }
                if (match_row.state === -1) {
                    updated.score1 = result.score1
                    updated.score2 = result.score2
                    updated.corner1 = result.corner1
                    updated.corner2 = result.corner2
                    updated.has_score = 1
                }

                //读取需要更新赛果的推荐
                const odds = await PromotedOdd.findAll({
                    where: {
                        match_id: match.id,
                    },
                })

                //计算赛果并写入数据
                await db.transaction(async (transaction) => {
                    await Match.update(updated, {
                        where: {
                            id: match.id,
                        },
                        transaction,
                        returning: false,
                    })

                    //设置盘口的结果
                    for (const odd of odds) {
                        const odd_result = getOddResult(odd, result)
                        if (!odd_result) continue

                        odd.result1 = odd_result.result
                        odd.score = odd_result.score
                        odd.score1 = odd_result.score1
                        odd.score2 = odd_result.score2

                        if (!isNullOrUndefined(odd.type2) && !isNullOrUndefined(odd.condition2)) {
                            const odd_result2 = getOddResult(
                                {
                                    variety: odd.variety,
                                    period: odd.period,
                                    type: odd.type2,
                                    condition: odd.condition2,
                                },
                                result,
                            )
                            if (odd_result2) {
                                odd.result2 = odd_result2.result
                            }
                        }

                        //计算总赛果
                        if (!isNullOrUndefined(odd.result2)) {
                            if (odd.result1 === 1 || odd.result2 === 1) {
                                odd.result = 1
                            } else if (odd.result1 === 0 && odd.result2 === 0) {
                                odd.result = 0
                            } else {
                                odd.result = -1
                            }
                        } else {
                            odd.result = odd.result1
                        }

                        await odd.save({ transaction, returning: false })
                    }
                })
            }
        } catch (err) {
            console.error(err)
        }
    }
}

/**
 * 启动球探网盘口抓取
 */
export async function startTitan007Robot() {
    //启动球探网比赛抓取
    processMatches()

    //启动球探网盘口抓取
    processOdds()

    //启动球探网赛果抓取
    processScore()
}

if (require.main === module) {
    startTitan007Robot()
}
