import axios from 'axios'
import { load } from 'cheerio'
import dayjs from 'dayjs'
import Decimal from 'decimal.js'
import { decode } from 'iconv-lite'
import levenshtein from 'js-levenshtein'
import { uniq } from 'lodash'
import { Op } from 'sequelize'
import { RateLimiter } from './common/rate-limit'
import { Match, PromotedOdd, Team } from './db'

const titan007Limiter = new RateLimiter(1000)

/**
 * 获取球探网的比赛结果
 * @param match_id 球探网比赛id
 */
async function getScore(match_id: string) {
    await titan007Limiter.add(() => {})

    //读取比分
    const respScore = await axios.request({
        url: `https://livestatic.titan007.com/flashdata/get`,
        params: {
            id: match_id,
            r: `007${Date.now()}`,
        },
        headers: {
            Referer: `https://live.titan007.com/detail/${match_id}sb.htm`,
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        method: 'GET',
        responseType: 'text',
    })

    const scoreTexts = (respScore.data as string).split('^')
    const score1 = scoreTexts[6]
    const score2 = scoreTexts[7]
    const score1_period1 = scoreTexts[15]
    const score2_period1 = scoreTexts[16]

    await titan007Limiter.add(() => {})
    const resp = await axios.request({
        url: `https://live.titan007.com/detail/${match_id}sb.htm`,
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        method: 'GET',
        responseType: 'text',
    })

    const $ = load(resp.data)

    const corner = $('#teamTechDiv > .lists').eq(0)
    const corner1 = corner.find('.data span').eq(0).text()
    const corner2 = corner.find('.data span').eq(2).text()
    const corner_period1 = $('#teamTechDiv > .lists').eq(1)
    const corner1_period1 = corner_period1.find('.data span').eq(0).text()
    const corner2_period1 = corner_period1.find('.data span').eq(2).text()

    return {
        score1: parseInt(score1),
        score2: parseInt(score2),
        score1_period1: parseInt(score1_period1),
        score2_period1: parseInt(score2_period1),
        corner1: parseInt(corner1),
        corner2: parseInt(corner2),
        corner1_period1: parseInt(corner1_period1),
        corner2_period1: parseInt(corner2_period1),
    }
}

/**
 * 从球探网获取所有完场比赛的id
 */
async function getTodayMatches() {
    await titan007Limiter.add(() => {})
    //读取赛程列表
    const resp = await axios.request({
        url: 'https://livestatic.titan007.com/vbsxml/bfdata_ut.js',
        params: {
            r: `007${Date.now()}`,
        },
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        responseType: 'text',
    })

    const script = (resp.data as string).replace('ShowBf()', 'ShowBf(A)')

    const matches = await new Promise<string[][]>((resolve, reject) => {
        function ShowBf(matches: any) {
            resolve(matches)
        }
        try {
            eval(script)
        } catch (err) {
            reject(err)
        }
    })

    //处理名称翻译
    const respAlias = await axios.request({
        url: `https://livestatic.titan007.com/vbsxml/alias3.txt`,
        params: {
            r: `007${Date.now()}`,
        },
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        responseType: 'text',
    })

    //解析队伍名称
    const alias = Object.fromEntries(
        (respAlias.data as string).split(',').map((row) => {
            const parts = row.split('^')
            return [parts[0], parts[2].replace(/[()（）]|\s/g, '')]
        }),
    )

    //对比赛进行筛选，只留下完场的比赛
    const filtered = matches
        .filter((row) => -1 == parseInt(row[13]))
        .map((row) => {
            const dateParts = row[12].split(',')
            const time = new Date(
                Date.parse(
                    `${dateParts[0]}/${parseInt(dateParts[1]) + 1}/${dateParts[2]} ${row[11]}`,
                ),
            )
            const team1_id = row[37]
            const team2_id = row[38]
            return {
                match_id: row[0],
                time,
                match_time: time.valueOf(),
                team1:
                    alias[team1_id] ??
                    row[5].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/g, ''),
                team2:
                    alias[team2_id] ??
                    row[8].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/g, ''),
            }
        })

    return filtered
}

/**
 * 获取更早的比赛的id
 */
async function getYesterdayMatches() {
    await titan007Limiter.add(() => {})

    const today = dayjs().hour(0).minute(0).second(0).millisecond(0)

    const yesterday = today.clone().add(-1, 'day')

    //读取赛程列表
    const resp = await axios.request({
        url: `https://bf.titan007.com/football/hg/Over_${yesterday.format('YYYYMMDD')}.htm?finCookie=1`,
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        responseType: 'arraybuffer',
    })

    const html = decode(resp.data, 'GBK')

    const $ = load(html)
    const list = $('#table_live').find('tr[sid]')

    const output: Awaited<ReturnType<typeof getTodayMatches>> = []

    const length = list.length
    for (let i = 0; i < length; i++) {
        const tr = list.eq(i)

        //解析时间
        const timeStr = tr.find('td').eq(1).text()
        const match = /([0-9]+)日([0-9]+):([0-9]+)/.exec(timeStr)
        if (!match) continue
        const date = parseInt(match[1])
        let time: Date
        if (date === today.date()) {
            //今天
            time = today.clone().hour(parseInt(match[2])).minute(parseInt(match[3])).toDate()
        } else {
            //昨天
            time = yesterday.clone().hour(parseInt(match[2])).minute(parseInt(match[3])).toDate()
        }

        const team1Cell = tr.find('td').eq(3)
        team1Cell.find('*').remove()
        const team1 = team1Cell
            .text()
            .trim()
            .replace(/[()（）]|\s/g, '')

        const team2Cell = tr.find('td').eq(5)
        team2Cell.find('*').remove('*')
        const team2 = team2Cell
            .text()
            .trim()
            .replace(/[()（）]|\s/g, '')

        output.push({
            match_id: tr.attr('sid')!,
            time,
            match_time: time.valueOf(),
            team1,
            team2,
        })
    }

    return output
}

/**
 * 计算完成比赛的赛果
 */
async function getMatchesScore(matches: Match[]) {
    let scoreData: Awaited<ReturnType<typeof getTodayMatches>>
    try {
        scoreData = await getTodayMatches()

        //如果超过凌晨3点，那么也读取昨天的数据
        if (new Date().getHours() >= 3) {
            scoreData = scoreData.concat(await getYesterdayMatches())
        }
    } catch (err) {
        console.error(err)
        return
    }

    for (const match of matches) {
        const team1_name = match.team1.name.replace(/[()（）]|\s/g, '')
        const team2_name = match.team2.name.replace(/[()（）]|\s/g, '')

        //从完场比赛中找出相似度高且比赛时间高度接近的比赛
        const found = scoreData.find((row) => {
            if (Math.abs(row.match_time - match.match_time.valueOf()) > 1800000) return false
            const team1_match = (() => {
                if (levenshtein(team1_name, row.team1) <= 3) {
                    return true
                }
                return false
            })()
            const team2_match = (() => {
                if (levenshtein(team2_name, row.team2) <= 3) {
                    return true
                }
                return false
            })()
            if (!team1_match || !team2_match) return false
            return true
        })

        if (!found) continue

        let score: Awaited<ReturnType<typeof getScore>>
        try {
            score = await getScore(found.match_id)
        } catch (err) {
            console.error(err)
            continue
        }

        //更新赛事结果
        await Match.update(
            {
                ...score,
                has_score: true,
            },
            {
                where: {
                    id: match.id,
                },
            },
        )

        //计算推荐赛事的结果
        const odds = await PromotedOdd.findAll({
            where: {
                match_id: match.id,
                is_valid: true,
            },
        })

        if (odds.length > 0) {
            for (const odd of odds) {
                const result = getOddResult(score, odd)
                if (result) {
                    odd.score = result.score
                    odd.result = result.result
                    await odd.save()
                }
            }
        }
    }
}

function parseCondition(value: string) {
    const returnValue = {
        symbol: value.startsWith('-') ? '-' : '+',
        value: [] as string[],
    }

    value = Decimal(value).abs().toString()
    if (value.endsWith('.25') || value.endsWith('.75')) {
        const lowValue = Decimal(value).sub('0.25').toString()
        const highValue = Decimal(value).add('0.25').toString()
        returnValue.value = [lowValue, highValue]
    } else {
        returnValue.value = [value]
    }

    if (returnValue.symbol === '-' && returnValue.value.length > 1) {
        returnValue.value.reverse()
    }

    return returnValue
}

/**
 * 计算赛果
 */
function getOddResult(match_score: Awaited<ReturnType<typeof getScore>>, odd: PromotedOdd) {
    let score: {
        score1: number
        score2: number
        total: number
    }

    if (odd.variety === 'goal') {
        //进球
        if (odd.period === 'period1') {
            //上半场
            score = {
                score1: match_score.score1_period1,
                score2: match_score.score2_period1,
                total: match_score.score1_period1 + match_score.score2_period1,
            }
        } else {
            //全场
            score = {
                score1: match_score.score1,
                score2: match_score.score2,
                total: match_score.score1 + match_score.score2,
            }
        }
    } else if (odd.variety === 'corner') {
        //角球
        if (odd.period === 'period1') {
            //上半场
            score = {
                score1: match_score.corner1_period1,
                score2: match_score.corner2_period1,
                total: match_score.corner1_period1 + match_score.corner2_period1,
            }
        } else {
            //全场
            score = {
                score1: match_score.corner1,
                score2: match_score.corner2,
                total: match_score.corner1 + match_score.corner2,
            }
        }
    } else {
        return
    }

    //计算赛果
    const condition = parseCondition(odd.condition)

    if (odd.type === 'ah1') {
        //主队
        const score_parts = condition.value.map((adjust) => {
            return condition.symbol === '-'
                ? Decimal(score.score1).sub(adjust)
                : Decimal(score.score1).add(adjust)
        })

        let result = score_parts.reduce<number>((lastValue, item) => {
            return lastValue + item.comparedTo(score.score2)
        }, 0)

        result = result > 0 ? 1 : result < 0 ? -1 : 0

        return {
            score: `${score.score1}:${score.score2}`,
            result,
        }
    } else if (odd.type === 'ah2') {
        //客队
        const score_parts = condition.value.map((adjust) => {
            return condition.symbol === '-'
                ? Decimal(score.score2).sub(adjust)
                : Decimal(score.score2).add(adjust)
        })

        let result = score_parts.reduce<number>((lastValue, item) => {
            return lastValue + item.comparedTo(score.score1)
        }, 0)

        result = result > 0 ? 1 : result < 0 ? -1 : 0

        return {
            score: `${score.score1}:${score.score2}`,
            result,
        }
    } else if (odd.type === 'over') {
        //大球
        let result = condition.value.reduce<number>((lastValue, item) => {
            return lastValue + Decimal(score.total).comparedTo(item)
        }, 0)

        result = result > 0 ? 1 : result < 0 ? -1 : 0

        return {
            score: score.total.toString(),
            result,
        }
    } else if (odd.type === 'under') {
        //小球
        let result = condition.value.reduce<number>((lastValue, item) => {
            return lastValue + Decimal(item).comparedTo(score.total)
        }, 0)

        result = result > 0 ? 1 : result < 0 ? -1 : 0

        return {
            score: score.total.toString(),
            result,
        }
    }
}

/**
 * 负责爬取赛果的脚本
 */
export async function startScoreRobot() {
    const limiter = new RateLimiter(60000)

    while (true) {
        await limiter.add(() => {})

        //读取待计算赛果的比赛
        const matches = await Match.findAll({
            where: {
                status: 'final',
                match_time: {
                    [Op.lt]: new Date(Date.now() - 9000000),
                },
                has_score: false,
            },
        })

        console.log('待计算赛果的比赛', matches.length)
        if (matches.length === 0) continue

        //读取队伍名称
        const teams = await Team.findAll({
            where: {
                id: {
                    [Op.in]: uniq(matches.map((t) => [t.team1_id, t.team2_id])).flat(),
                },
            },
        })

        for (const match of matches) {
            match.team1 = teams.find((t) => t.id === match.team1_id)!
            match.team2 = teams.find((t) => t.id === match.team2_id)!
        }

        await getMatchesScore(matches)
    }
}

if (require.main === module) {
    startScoreRobot()
        .then(() => {
            process.exit()
        })
        .catch((err) => {
            console.error(err)
            process.exit()
        })
}
