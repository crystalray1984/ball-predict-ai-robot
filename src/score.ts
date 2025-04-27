import 'reflect-metadata'
import './config'

import axios from 'axios'
import { load } from 'cheerio'
import dayjs from 'dayjs'
import { decode } from 'iconv-lite'
import levenshtein from 'js-levenshtein'
import { api } from './common/api'
import { RateLimiter } from './common/rate-limit'

const titan007Limiter = new RateLimiter(1000)

/**
 * 获取球探网的比赛结果
 * @param match_id 球探网比赛id
 */
async function getScore(match_id: string): Promise<MatchScore> {
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
    let corner1 = corner.find('.data span').eq(0).text()
    let corner2 = corner.find('.data span').eq(2).text()
    const corner_period1 = $('#teamTechDiv > .lists').eq(1)
    let corner1_period1 = corner_period1.find('.data span').eq(0).text()
    let corner2_period1 = corner_period1.find('.data span').eq(2).text()

    //如果没有获取到角球数据，统一视为0
    if (corner1 === '') {
        corner1 = '0'
    }
    if (corner2 === '') {
        corner2 = '0'
    }
    if (corner1_period1 === '') {
        corner1_period1 = '0'
    }
    if (corner2_period1 === '') {
        corner2_period1 = '0'
    }

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
async function getTodayMatches(): Promise<Titan007MatchInfo[]> {
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
async function getYesterdayMatches(): Promise<Titan007MatchInfo[]> {
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

    const output: Titan007MatchInfo[] = []

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
async function getMatchesScore(matches: BaseMatch[]): Promise<MatchScoreWithId[]> {
    let scoreData: Awaited<ReturnType<typeof getTodayMatches>>
    try {
        scoreData = await getTodayMatches()

        //如果超过凌晨3点，那么也读取昨天的数据
        if (new Date().getHours() >= 3) {
            scoreData = scoreData.concat(await getYesterdayMatches())
        }
    } catch (err) {
        console.error(err)
        return []
    }

    const result: MatchScoreWithId[] = []

    for (const match of matches) {
        const team1_name = match.team1.replace(/[()（）]|\s/g, '')
        const team2_name = match.team2.replace(/[()（）]|\s/g, '')
        const match_time = dayjs(match.match_time)

        //先寻找完全匹配的数据
        let found = scoreData.find((row) => {
            if (Math.abs(row.match_time - match_time.valueOf()) > 1800000) return false

            return team1_name === row.team1 && team2_name === row.team2
        })

        if (!found) {
            //再寻找高度相似的队伍
            found = scoreData.find((row) => {
                if (Math.abs(row.match_time - match_time.valueOf()) > 1800000) return false

                let team1_level = Math.min(
                    Math.max(Math.floor(Math.min(team1_name.length, row.team1.length) / 3), 1),
                    2,
                )
                let team2_level = Math.min(
                    Math.max(Math.floor(Math.min(team2_name.length, row.team2.length) / 3), 1),
                    2,
                )
                const team1_match = (() => {
                    if (levenshtein(team1_name, row.team1) <= team1_level) {
                        return true
                    }
                    return false
                })()
                const team2_match = (() => {
                    if (levenshtein(team2_name, row.team2) <= team2_level) {
                        return true
                    }
                    return false
                })()
                if (!team1_match || !team2_match) return false
                return true
            })
        }

        if (!found) continue

        let score: MatchScore
        try {
            score = await getScore(found.match_id)
            console.log({
                match_id: match.id,
                match: `${team1_name} vs ${team2_name}`,
                found: `${found.team1} vs ${found.team2}`,
                ...score,
            })
            result.push({
                ...score,
                match_id: match.id,
            })
        } catch (err) {
            console.error(err)
            continue
        }
    }

    return result
}

/**
 * 基础比赛数据
 */
interface BaseMatch {
    id: number
    match_time: string
    team1: string
    team2: string
}

export async function startScoreRobot() {
    const limiter = new RateLimiter(60000)

    while (true) {
        await limiter.add(() => {})

        try {
            //读取待计算赛果的比赛
            const retMatches = await api<BaseMatch[]>({
                url: '/admin/match/require_score_list',
            })

            console.log('需要获取赛果的比赛', retMatches.data.length)

            if (retMatches.data.length === 0) {
                continue
            }

            const result = await getMatchesScore(retMatches.data)
            if (result.length > 0) {
                //提交赛果数据
                await api({
                    url: '/admin/match/multi_set_score',
                    data: result,
                })
            }
        } catch (err) {
            console.error(err)
        }
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
// if (require.main === module) {
//     getScore('2616747')
//         .then((ret) => {
//             console.log(ret)
//             process.exit()
//         })
//         .catch((err) => {
//             console.error(err)
//             process.exit()
//         })
// }
