import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import Decimal from 'decimal.js'
import { pick } from 'lodash'
import { type CreationAttributes, Op, QueryTypes } from 'sequelize'
import { RateLimiter } from './common/rate-limit'
import { getSetting } from './common/settings'
import { changeRatio, changeValue, getCrownData, getCrownMatches, init } from './crown'
import { db, Match, Odd, PromotedOdd, Team, Tournament } from './db'
import { getSurebets } from './surebet'

dayjs.extend(utc)
dayjs.extend(timezone)

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

    if (exists && exists.status !== '') {
        //如果盘口且已经处于第一次比对满足状态已经存在就不处理了
        return
    }

    //抓取皇冠数据
    const crownData = await getCrownData(row.crown_match_id, getShowType(row.match_time))

    //进入“准备”判断流程
    const data = await compareReadyData(row, crownData)
    if (data) {
        if (exists) {
            //更新比对数据
            await exists.update({
                surebet_value: row.surebet_value,
                crown_value: data.data.value,
                status: 'ready',
                surebet_updated_at,
                crown_updated_at: new Date(),
            })
        } else {
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
    //读取配置
    const { corner_enable, corner_reverse, promote_reverse, period1_enable, filter_rate } =
        await getSetting(
            'corner_enable',
            'corner_reverse',
            'promote_reverse',
            'period1_enable',
            'filter_rate',
        )

    //抓取皇冠数据
    const crownData = await getCrownData(match.crown_match_id.toString(), 'today')

    //待插入的推荐数据
    const promote_odd_attrs: CreationAttributes<PromotedOdd>[] = []

    //对比赛中的每个盘口进行比对
    for (const odd of match.odds) {
        //第一波过滤，参数过滤
        const pass = (() => {
            if (!corner_enable && odd.variety === 'corner') {
                //角球过滤
                return false
            }
            if (!period1_enable && odd.period === 'period1') {
                //上半场过滤
                return false
            }

            return true
        })()

        if (pass) {
            //所有数据都通过，才进行数据比对
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
                    condition: odd.condition,
                },
            }

            //最终数据比对
            const datas = await compareFinalData(oddData, crownData)

            if (datas.length > 0) {
                //有满足条件的数据

                //计算推荐数据
                const { condition, type } = (() => {
                    //是否反向推荐
                    const reverse = odd.variety === 'corner' ? corner_reverse : promote_reverse
                    if (!reverse) {
                        //直接正向推荐
                        return { condition: odd.condition, type: odd.type }
                    } else if (odd.type === 'under' || odd.type === 'over') {
                        //对于大小球，条件不需要反向，只是投注目标反向
                        return {
                            condition: odd.condition,
                            type: odd.type === 'under' ? 'over' : 'under',
                        }
                    } else {
                        //让球盘，条件和购买方向都是反向
                        return {
                            condition: Decimal(0).sub(odd.condition).toString(),
                            type: odd.type === 'ah1' ? 'ah2' : 'ah1',
                        }
                    }
                })()

                //然后插入推荐数据
                promote_odd_attrs.push({
                    odd_id: odd.id,
                    match_id: match.id,
                    variety: odd.variety,
                    period: odd.period,
                    condition,
                    type,
                })
            }
        } else {
            //不需要比对，直接放弃的盘口
            odd.status = 'ignored'
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
        }
    }

    //更新原始推荐数据
    const promotedOddIds = match.odds
        .filter((t) => promote_odd_attrs.some((tt) => tt.odd_id === t.id))
        .map((t) => t.id)
    const ignoredOddIds = match.odds
        .filter((t) => !promote_odd_attrs.some((tt) => tt.odd_id === t.id))
        .map((t) => t.id)
    if (promotedOddIds.length > 0) {
        await Odd.update(
            {
                status: 'promoted',
            },
            {
                where: {
                    id: {
                        [Op.in]: promotedOddIds,
                    },
                },
            },
        )
    }
    if (ignoredOddIds.length > 0) {
        await Odd.update(
            {
                status: 'ignored',
            },
            {
                where: {
                    id: {
                        [Op.in]: ignoredOddIds,
                    },
                },
            },
        )
    }

    //对推荐的数据进行筛选，相同的盘口，只推荐条件更容易达成的
    const filtered: CreationAttributes<PromotedOdd>[] = []
    promote_odd_attrs.forEach((row) => {
        const existsIndex = filtered.findIndex((t) => {
            return t.period === row.period && t.type === row.type && t.variety === row.variety
        })

        //没找到直接添加就行
        if (existsIndex === -1) {
            filtered.push(row)
            return
        }

        //如果找到了就进行对比，要更容易完成的那个
        const exists = filtered[existsIndex]
        let replace = false
        switch (row.type) {
            case 'ah1':
            case 'ah2':
                //对于让球，本方让球数更低或者受让数更高的为容易达成的
                replace = Decimal(row.condition).comparedTo(exists.condition) > 0
                break
            case 'under':
                //小球，大球越高越容易
                replace = Decimal(row.condition).comparedTo(exists.condition) > 0
                break
            case 'over':
                //大球，大球越低越容易
                replace = Decimal(row.condition).comparedTo(exists.condition) < 0
                break
        }

        if (replace) {
            filtered.splice(existsIndex, 1, row)
        }
    })

    //根据筛选后的盘口创建推荐数据
    for (const row of filtered) {
        const promoted = await PromotedOdd.create(row, { returning: ['id'] })

        //根据推荐率，设定此盘口是否推荐
        const count = await PromotedOdd.count({
            where: {
                id: {
                    [Op.lte]: promoted.id,
                },
            },
        })
        let is_valid: boolean
        switch (filter_rate) {
            case 1:
                //4场推1场
                is_valid = count % 4 === 0
                break
            case 2:
                is_valid = count % 2 === 0
                //4场推2场
                break
            case 2:
                //4场推3场
                is_valid = count % 4 !== 3
                break
            default:
                //全推
                is_valid = true
                break
        }
        await PromotedOdd.update(
            {
                is_valid,
            },
            {
                where: {
                    id: promoted.id,
                },
                limit: 1,
            },
        )
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
    const { promote_condition, allow_promote_1, promote_symbol } = await getSetting<string>(
        'promote_condition',
        'allow_promote_1',
        'promote_symbol',
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
        if (promote_symbol === '<=') {
            if (!Decimal(equals.data.value).sub(surebet.surebet_value).lte(promote_condition)) {
                //条件不满足
                return []
            }
        } else {
            if (!Decimal(equals.data.value).sub(surebet.surebet_value).gte(promote_condition)) {
                //条件不满足
                return []
            }
        }

        //返回最终数据
        //球队的信息要使用主盘口的
        const mainGame = crown.game.filter((game) => game.ptype_id == '0')[0] ?? crown.game[0]
        Object.assign(
            equals.game,
            pick(mainGame, 'lid', 'league', 'team_id_h', 'team_id_c', 'team_h', 'team_c'),
        )
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

    //返回的信息使用主盘口的
    const mainGame = crown.game.filter((game) => game.ptype_id == '0')[0] ?? crown.game[0]
    result.forEach((row) => {
        Object.assign(
            row.game,
            pick(mainGame, 'lid', 'league', 'team_id_h', 'team_id_c', 'team_h', 'team_c'),
        )
    })

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

    //条件满足就返回皇冠的数据，但是球队的信息要使用主盘口的
    const mainGame = crown.game.filter((game) => game.ptype_id == '0')[0] ?? crown.game[0]
    Object.assign(
        equals.game,
        pick(mainGame, 'lid', 'league', 'team_id_h', 'team_id_c', 'team_h', 'team_c'),
    )
    return equals
}

let lastMatchTime = 0

/**
 * 启动爬虫任务
 */
export async function startRobot() {
    //首先初始化皇冠爬取环境
    while (true) {
        try {
            await init()
            break
        } catch {
            continue
        }
    }

    //然后启动surebet循环拉取数据
    const limiter = new RateLimiter(60000)

    while (true) {
        await limiter.add(() => {})

        try {
            //读取所有从surebet筛选来的数据
            const odds = await getSurebets()
            console.log(`收到筛选后的surebet数据 ${odds.length}条`)
            odds.forEach((odd) => console.log(odd))

            //循环处理surebet抓回来的数据
            for (const odd of odds) {
                try {
                    await processOdd(odd)
                } catch (err) {
                    console.error(err)
                }
            }

            //处理开赛前2分钟的比赛
            let nearlyMatches = await db.query(
                {
                    query: `
            SELECT
                "match".*
            FROM
                "match"
            INNER JOIN
                "odd" ON "odd"."match_id" = "match".id AND "odd"."status" = ?
            WHERE
                "match"."match_time" > ? AND "match"."match_time" <= ? AND "match"."status" = ?
            ORDER BY
                "match"."match_time"
            `,
                    values: ['ready', new Date(), new Date(Date.now() + 120000), ''],
                },
                {
                    type: QueryTypes.SELECT,
                    model: Match,
                },
            )

            console.log('2分钟内开赛的比赛', nearlyMatches.length)

            if (nearlyMatches.length > 0) {
                const odds = await Odd.findAll({
                    where: {
                        match_id: {
                            [Op.in]: nearlyMatches.map((t) => t.id),
                        },
                        status: 'ready',
                    },
                })

                console.log('2分钟内开赛的盘口', odds.length)

                nearlyMatches.forEach((match) => {
                    match.odds = odds.filter((t) => t.match_id === match.id)
                })

                nearlyMatches = nearlyMatches.filter((t) => t.odds.length > 0)

                for (const match of nearlyMatches) {
                    try {
                        await processNearlyMatch(match)
                    } catch (err) {
                        console.error(err)
                    }
                }
            }

            //如果20分钟内没有开赛的比赛，且距离上次抓取比赛列表超过1个小时，那么抓取皇冠的比赛列表
            if (Date.now() - lastMatchTime >= 3600000) {
                const hasNearlyMatch = await db.query(
                    {
                        query: `
                SELECT
                    "match"."id"
                FROM
                    "match"
                INNER JOIN
                    "odd" ON "odd"."match_id" = "match".id AND "odd"."status" = ?
                WHERE
                    "match"."match_time" > ? AND "match"."match_time" <= ? AND "match"."status" = ?
                LIMIT 1
                `,
                        values: ['ready', new Date(), new Date(Date.now() + 1200000), ''],
                    },
                    {
                        type: QueryTypes.SELECT,
                        raw: true,
                    },
                )

                if (hasNearlyMatch.length > 0) {
                    //可以抓取皇冠比赛列表
                    try {
                        console.log('正在抓取皇冠比赛列表')
                        const matches = await getCrownMatches()
                        let insertedCount = 0
                        for (const matchData of matches) {
                            const timeMatch = /([0-9]+)-([0-9]+) ([0-9]+):([0-9]+)(a|p)/.exec(
                                matchData.DATETIME,
                            )!

                            let hour = parseInt(timeMatch[3])
                            if (timeMatch[5] === 'p') {
                                hour += 12
                            }

                            const baseTime = dayjs.tz(matchData.SYSTIME, 'America/New_York')
                            let matchTime = dayjs.tz(
                                `${baseTime.year()}-${timeMatch[1]}-${timeMatch[2]} ${hour.toString().padStart(2, '0')}:${timeMatch[4]}`,
                                'America/New_York',
                            )

                            //比赛时间不应小于当前时间，否则就年份+1
                            if (matchTime.valueOf() < baseTime.valueOf()) {
                                matchTime = matchTime.add(1, 'year')
                            }

                            const exists = await Match.findOne({
                                where: {
                                    crown_match_id: matchData.ECID,
                                },
                                attributes: ['id', 'match_time'],
                            })
                            if (exists) {
                                //更新比赛时间
                                if (exists.match_time.valueOf() !== matchTime.valueOf()) {
                                    await Match.update(
                                        {
                                            match_time: matchTime.toDate(),
                                        },
                                        {
                                            where: {
                                                id: exists.id,
                                            },
                                        },
                                    )
                                }
                                continue
                            }

                            //查询联赛是否存在
                            let tournament = await Tournament.findOne({
                                where: {
                                    crown_tournament_id: matchData.LID,
                                },
                                attributes: ['id'],
                            })
                            if (!tournament) {
                                //保存联赛
                                tournament = await Tournament.create({
                                    crown_tournament_id: matchData.LID,
                                    name: matchData.LEAGUE,
                                })
                            }

                            //查询队伍是否存在
                            let team1 = await Team.findOne({
                                where: {
                                    crown_team_id: matchData.TEAM_H_ID,
                                },
                                attributes: ['id'],
                            })
                            if (!team1) {
                                team1 = await Team.create({
                                    crown_team_id: matchData.TEAM_H_ID,
                                    name: matchData.TEAM_H,
                                })
                            }
                            let team2 = await Team.findOne({
                                where: {
                                    crown_team_id: matchData.TEAM_C_ID,
                                },
                                attributes: ['id'],
                            })
                            if (!team2) {
                                team2 = await Team.create({
                                    crown_team_id: matchData.TEAM_C_ID,
                                    name: matchData.TEAM_C,
                                })
                            }

                            //插入比赛
                            await Match.create(
                                {
                                    crown_match_id: matchData.ECID,
                                    team1_id: team1.id,
                                    team2_id: team2.id,
                                    tournament_id: tournament.id,
                                    match_time: matchTime.toDate(),
                                },
                                {
                                    returning: false,
                                },
                            )
                            insertedCount++
                        }
                        console.log('新增比赛数据', insertedCount)
                        lastMatchTime = Date.now()
                    } catch (err) {
                        console.error(err)
                    }
                }
            }
        } catch (err) {
            console.error(err)
        }
    }
}

if (require.main === module) {
    startRobot().catch(() => {
        process.exit(1)
    })
}
