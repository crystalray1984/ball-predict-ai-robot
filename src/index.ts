import 'reflect-metadata'
import './config'

import dayjs from 'dayjs'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import { RateLimiter } from './common/rate-limit'
import { getSetting } from './common/settings'
import { changeRatio, changeValue, getCrownData, init } from './crown'
import { Match, Odd, Team, Tournament } from './db'
import { getSurebets } from './surebet'

/**
 * 根据比赛时间确定用“早盘”还是“今日”获取皇冠数据
 * @param match_time 比赛时间
 */
function getShowType(match_time: number) {
    const edge = dayjs().startOf('day').add(1, 'day').add(12, 'hour').valueOf()
    return match_time >= edge ? 'early' : 'today'
}

/**
 * 处理来自surebet的单场比赛的数据
 * @param row
 */
async function processOdd(row: Surebet.OutputData) {
    const surebet_updated_at = new Date()

    //首先对盘口进行判断，是否已经存在
    const exists = await Odd.findOne({
        where: {
            crown_match_id: row.crown_match_id,
            game: row.type.game,
            base: row.type.base,
            variety: row.type.variety,
            period: row.type.period,
            type: row.type.type,
            condition: row.type.condition,
        },
        include: [
            {
                model: Match,
                required: true,
            },
        ],
    })

    if (exists) {
        //如果盘口已经存在就不处理了
        return
    }

    //抓取皇冠数据
    const crownData = await getCrownData(row.crown_match_id, getShowType(row.match_time))

    //如果比赛在3分钟内开始，那么进入最终判断流程
    if (Date.now() - row.match_time <= 180000) {
        const datas = await compareFinalData(row, crownData)
        if (datas.length === 0) return

        //把满足条件的盘口全部插入为“已推荐”
        for (const data of datas) {
            //盘口的条件满足，进入“准备中”
            let match = await Match.findOne({
                where: {
                    crown_match_id: Number(row.crown_match_id),
                },
            })
            if (!match) {
                //获取赛事id
                let tournament = await Tournament.findOne({
                    where: {
                        crown_tournament_id: Number(data.game.lid),
                    },
                })
                if (!tournament) {
                    tournament = await Tournament.create({
                        crown_tournament_id: Number(data.game.lid),
                        name: data.game.league,
                    })
                }

                //获取队伍id
                let team1 = await Team.findOne({
                    where: {
                        crown_team_id: Number(data.game.team_id_h),
                    },
                })
                if (!team1) {
                    team1 = await Team.create({
                        crown_team_id: Number(data.game.team_id_h),
                        name: data.game.team_h,
                    })
                }
                let team2 = await Team.findOne({
                    where: {
                        crown_team_id: Number(data.game.team_id_c),
                    },
                })
                if (!team2) {
                    team2 = await Team.create({
                        crown_team_id: Number(data.game.team_id_c),
                        name: data.game.team_c,
                    })
                }

                //插入赛事
                match = await Match.create({
                    tournament_id: tournament.id,
                    crown_match_id: Number(row.crown_match_id),
                    team1_id: team1.id,
                    team2_id: team2.id,
                    match_time: new Date(row.match_time),
                })
            }

            //插入盘口
            await Odd.create({
                match_id: match.id,
                crown_match_id: Number(row.crown_match_id),
                game: row.type.game,
                base: row.type.base,
                variety: row.type.variety,
                period: row.type.period,
                type: row.type.type,
                condition: row.type.condition!,
                surebet_value: row.surebet_value,
                crown_value: data.data.value,
                status: 'promoted',
                surebet_updated_at,
                crown_updated_at: new Date(),
            })
        }
    } else {
        //否则进入“准备”判断流程
        const data = await compareReadyData(row, crownData)
        if (data) {
            //盘口的条件满足，进入“准备中”
            let match = await Match.findOne({
                where: {
                    crown_match_id: Number(row.crown_match_id),
                },
            })
            if (!match) {
                //获取赛事id
                let tournament = await Tournament.findOne({
                    where: {
                        crown_tournament_id: Number(data.game.lid),
                    },
                })
                if (!tournament) {
                    tournament = await Tournament.create({
                        crown_tournament_id: Number(data.game.lid),
                        name: data.game.league,
                    })
                }

                //获取队伍id
                let team1 = await Team.findOne({
                    where: {
                        crown_team_id: Number(data.game.team_id_h),
                    },
                })
                if (!team1) {
                    team1 = await Team.create({
                        crown_team_id: Number(data.game.team_id_h),
                        name: data.game.team_h,
                    })
                }
                let team2 = await Team.findOne({
                    where: {
                        crown_team_id: Number(data.game.team_id_c),
                    },
                })
                if (!team2) {
                    team2 = await Team.create({
                        crown_team_id: Number(data.game.team_id_c),
                        name: data.game.team_c,
                    })
                }

                //插入赛事
                match = await Match.create({
                    tournament_id: tournament.id,
                    crown_match_id: Number(row.crown_match_id),
                    team1_id: team1.id,
                    team2_id: team2.id,
                    match_time: new Date(row.match_time),
                })
            }

            //插入盘口
            await Odd.create({
                match_id: match.id,
                crown_match_id: Number(row.crown_match_id),
                game: row.type.game,
                base: row.type.base,
                variety: row.type.variety,
                period: row.type.period,
                type: row.type.type,
                condition: row.type.condition!,
                surebet_value: row.surebet_value,
                crown_value: data.data.value,
                status: 'ready',
                surebet_updated_at,
                crown_updated_at: new Date(),
            })
        }
    }
}

/**
 * 处理即将开赛的比赛
 * @param odd
 */
async function processNearlyMatch(match: Match) {
    //抓取皇冠数据
    const crownData = await getCrownData(match.crown_match_id.toString(), 'today')

    //对比赛中的每个盘口进行比对
    for (const odd of match.odds) {
        //构建数据
        const oddData: Surebet.OutputData = {
            crown_match_id: match.crown_match_id.toString(),
            match_time: match.match_time.valueOf(),
            surebet_value: odd.surebet_value,
            type: {
                game: odd.game,
                base: odd.base,
                variety: odd.variety,
                period: odd.period,
                type: odd.type,
            },
        }

        //最终数据比对
        const datas = await compareFinalData(oddData, crownData)
        if (datas.length === 0) {
            odd.status = 'ignored'
            //没有任何满足条件的数据，将盘口标记为忽略
            await Odd.update(
                {
                    status: 'ignored',
                },
                {
                    where: {
                        id: odd.id,
                    },
                },
            )
        } else {
            odd.status = 'promoted'
            //有满足条件的数据，先把盘口标记为已推荐
            await Odd.update(
                {
                    status: 'promoted',
                },
                {
                    where: {
                        id: odd.id,
                    },
                },
            )
            //然后插入推荐数据
        }

        //最后把当场比赛标记为“已结算”
        await Match.update(
            {
                status: 'final',
            },
            {
                where: {
                    id: match.id,
                },
            },
        )
    }
}

/**
 * 满足条件的皇冠盘口数据
 */
interface MatchGameData {
    /**
     * 皇冠让球/大小球边界
     */
    condition: string
    /**
     * 皇冠赔率
     */
    value: string
}

/**
 * 根据surebet的盘口类型，获取皇冠的对应盘口
 * @param type
 * @param game
 */
function getGameData(type: Surebet.OddType, game: Crown.Game): MatchGameData | void {
    /**
     * 表示该盘口是否开启的字段名
     */
    const switchKey = (() => {
        if (type.period === 'regularTime') {
            //全场
            switch (type.type) {
                case 'ah1':
                case 'ah2':
                    //全场让球
                    return 'sw_R'
                default:
                    //全场大小球
                    return 'sw_OU'
            }
        } else {
            //上半场
            switch (type.type) {
                case 'ah1':
                case 'ah2':
                    //上半场让球
                    return 'sw_HR'
                default:
                    //上半场大小球
                    return 'sw_HOU'
            }
        }
    })()

    if (game[switchKey] !== 'Y') {
        //如果盘口未开启就直接返回
        return
    }

    let value: string, condition: string
    if (type.period === 'regularTime') {
        //全场
        switch (type.type) {
            case 'ah1':
                //全场让球—主胜
                condition = changeRatio(game.ratio)
                if (game.strong === 'H') {
                    //主队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_RH, game.ior_RC)[0]
                break
            case 'ah2':
                //全场让球-客胜
                condition = changeRatio(game.ratio)
                if (game.strong === 'C') {
                    //客队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_RH, game.ior_RC)[1]
                break
            case 'under':
                //全场大小球-小球
                condition = changeRatio(game.ratio_o)
                value = changeValue(game.ior_OUH, game.ior_OUC)[0]
                break
            default:
                //全场大小球-大球
                condition = changeRatio(game.ratio_o)
                value = changeValue(game.ior_OUH, game.ior_OUC)[1]
                break
        }
    } else {
        //上半场
        switch (type.type) {
            case 'ah1':
                //上半场让球—主胜
                condition = changeRatio(game.hratio)
                if (game.hstrong === 'H') {
                    //主队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_HRH, game.ior_HRC)[0]
                break
            case 'ah2':
                //上半场让球-客胜
                condition = changeRatio(game.hratio)
                if (game.hstrong === 'C') {
                    //客队让球
                    condition = `-${condition}`
                }
                value = changeValue(game.ior_HRH, game.ior_HRC)[1]
                break
            case 'under':
                //上半场大小球-小球
                condition = changeRatio(game.ratio_ho)
                value = changeValue(game.ior_HOUH, game.ior_HOUC)[0]
                break
            default:
                //上半场大小球-大球
                condition = changeRatio(game.ratio_ho)
                value = changeValue(game.ior_HOUH, game.ior_HOUC)[1]
                break
        }
    }

    return {
        condition,
        value,
    }
}

/**
 * 最终判断的盘口数据比对
 * @param surebet
 * @param crown
 */
async function compareFinalData(surebet: Surebet.OutputData, crown: Crown.Resp) {
    if (!Array.isArray(crown.game)) {
        return []
    }

    //首先通过读取一些配置值
    const { promote_condition, allow_promote_1, allow_promote_2 } = await getSetting<string>(
        'promote_condition',
        'allow_promote_1',
        'allow_promote_2',
    )

    //根据surebet的盘口类型寻找皇冠数据中的对应盘口
    const games = crown.game.filter((game) => {
        if (surebet.type.variety === 'goal') {
            //进球
            return game.ptype_id == '0'
        } else {
            //角球
            return game.ptype_id == '146'
        }
    })

    //从各个盘口中寻找与当前盘口相同的盘口
    const equals = games.reduce<
        | {
              game: Crown.Game
              data: MatchGameData
          }
        | undefined
    >((prev, game) => {
        if (prev) return prev
        //寻找类型相同的盘口
        const data = getGameData(surebet.type, game)
        if (!data) return
        if (Decimal(data.condition).equals(surebet.type.condition!)) {
            //条件也相同
            return {
                game,
                data,
            }
        }
    }, undefined)

    if (equals) {
        //从最终盘口中找到对应的盘口，进行最终判断
        if (!Decimal(equals.data.value).sub(surebet.surebet_value).gte(promote_condition)) {
            //条件不满足
            return []
        }

        //返回最终数据
        return [equals]
    }

    //没有对应盘口的时候判断一下开关
    if (!allow_promote_1) return []

    //没有从最终盘口中找到原来对应的盘口，那么对其他盘口进行判断
    const result: { game: Crown.Game; data: MatchGameData }[] = []
    for (const game of games) {
        //寻找类型相同的盘口
        const data = getGameData(surebet.type, game)
        if (!data) continue

        //有相同类型的盘口，判断是否满足条件
        switch (surebet.type.type) {
            case 'ah1':
            case 'ah2':
                //让球，如果让球方让球变小，或者受让方受让变大，那么可以反向推荐
                //负数绝对值变小，正数绝对值变大，就是数值变大
                if (Decimal(data.condition).gt(surebet.type.condition!)) {
                    result.push({
                        game,
                        data,
                    })
                }
                break
            case 'under':
                //大小球-小球，如果大球变大，那么可以反向推荐
                if (Decimal(data.condition).gt(surebet.type.condition!)) {
                    result.push({
                        game,
                        data,
                    })
                }
                break
            case 'over':
                //大小球-大球，如果大球变小，那么可以反向推荐
                if (Decimal(data.condition).lt(surebet.type.condition!)) {
                    result.push({
                        game,
                        data,
                    })
                }
                break
        }
    }

    return result
}

/**
 * 待准备的盘口数据比对
 * @param surebet
 * @param crown
 */
async function compareReadyData(surebet: Surebet.OutputData, crown: Crown.Resp) {
    if (!Array.isArray(crown.game)) {
        console.log('皇冠数据异常', crown)
        return
    }

    //首先通过读取一些配置值
    const ready_condition = (await getSetting<string>('promote_condition')) as string

    //根据surebet的盘口类型寻找皇冠数据中的对应盘口
    const games = crown.game.filter((game) => {
        if (surebet.type.variety === 'goal') {
            //进球
            return game.ptype_id == '0'
        } else {
            //角球
            return game.ptype_id == '146'
        }
    })

    //从各个盘口中寻找与当前盘口相同的盘口
    const equals = games.reduce<
        | {
              game: Crown.Game
              data: MatchGameData
          }
        | undefined
    >((prev, game) => {
        if (prev) return prev
        //寻找相同的盘口
        const data = getGameData(surebet.type, game)
        if (!data) return
        if (Decimal(data.condition).equals(surebet.type.condition!)) {
            //条件也相同
            return {
                game,
                data,
            }
        }
    }, undefined)

    if (!equals) {
        //没有从皇冠中找到相同的盘口
        return
    }

    //找到了盘口那么做赔率比对
    if (!Decimal(equals.data.value).sub(surebet.surebet_value).gte(ready_condition)) {
        //条件不满足
        return
    }

    //条件满足就返回皇冠的数据
    return equals
}

/**
 * 启动爬虫任务
 */
export async function startRobot() {
    //首先初始化皇冠爬取环境
    await init()

    //然后启动surebet循环拉取数据
    const limiter = new RateLimiter(60000)

    while (true) {
        await limiter.add(() => {})

        //读取所有从surebet筛选来的数据
        const odds = await getSurebets()
        console.log(`收到筛选后的surebet数据 ${odds.length}条`)
        odds.forEach((odd) => console.log(odd))

        //循环处理surebet抓回来的数据
        for (const odd of odds) {
            await processOdd(odd)
        }

        //处理开赛前2分钟的比赛
        let nearlyMatches = await Match.findAll({
            where: {
                match_time: {
                    [Op.lte]: new Date(Date.now() + 120000),
                    [Op.gt]: new Date(),
                    status: '',
                },
            },
        })

        if (nearlyMatches.length > 0) {
            const odds = await Odd.findAll({
                where: {
                    match_id: {
                        [Op.in]: nearlyMatches.map((t) => t.id),
                    },
                    status: 'ready',
                },
            })

            nearlyMatches.forEach((match) => {
                match.odds = odds.filter((t) => t.match_id === match.id)
            })

            nearlyMatches = nearlyMatches.filter((t) => t.odds.length > 0)

            for (const match of nearlyMatches) {
                await processNearlyMatch(match)
            }
        }
    }
}

if (require.main === module) {
    startRobot()
}
