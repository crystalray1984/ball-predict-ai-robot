import axios from 'axios'
import { api } from './common/api'
import { RateLimiter } from './common/rate-limit'
import dayjs from 'dayjs'
import { decode } from 'iconv-lite'
import { load } from 'cheerio'
import levenshtein from 'js-levenshtein'
import { pick } from 'lodash'

/**
 * 基础比赛数据
 */
interface BaseMatch {
    id: number
    match_time: string
    team1: string
    team2: string
    period1: boolean
}

const titan007Limiter = new RateLimiter(1000)

/**
 * 开启赛果抓取脚本
 */
export async function startScoreRobot() {
    const limiter = new RateLimiter(60000)

    while (true) {
        try {
            await limiter.add(() => {})

            //从接口读取待获取赛果的比赛
            const retMatches = await api<BaseMatch[]>({
                url: '/admin/match/require_score_list',
            })

            console.log('待获取赛果的比赛', retMatches.data.length)

            if (retMatches.data.length === 0) continue

            const results = await processMatchesScore(retMatches.data)
            console.log('已获取赛果的比赛', results.length)
            if (results.length > 0) {
                const ret = await api({
                    url: '/admin/match/multi_set_score',
                    data: results,
                })
                console.log('赛果设置结果', pick(ret, 'code', 'msg'))
            }
        } catch (err) {
            console.error(err)
        }
    }
}

/**
 * 处理比赛的赛果
 */
async function processMatchesScore(matches: BaseMatch[]): Promise<MatchScoreWithId[]> {
    let { finish, period1 } = await getTodayMatches()

    if (new Date().getHours() >= 12 && matches.some((t) => !t.period1)) {
        //如果超过了中午12点，且需要获取赛果的比赛中有全场的，那么也同时抓取昨天的数据
        const yesterdayList = await getYesterdayMatches()
        console.log('抓取到昨日完场比赛', yesterdayList.length)
        finish = finish.concat(yesterdayList)
    }

    console.log('抓取到今日完场比赛', finish.length)
    console.log('抓取到今日半场比赛', period1.length)

    const result: MatchScoreWithId[] = []

    //数据比对
    for (const match of matches) {
        //进行比赛比对
        const found = findMatch(match, match.period1 ? period1 : finish)
        if (!found) {
            console.log(
                '未找到匹配的比赛',
                dayjs(match.match_time).format('YYYY/MM/DD HH:mm'),
                match.team1,
                match.team2,
                match.period1 ? '半场' : '全场',
            )
            continue
        }

        //获取比赛数据
        const score = await getMatchScore(found.match_id)
        console.log(
            '比赛结果',
            dayjs(match.match_time).format('YYYY/MM/DD HH:mm'),
            match.team1,
            match.team2,
            match.period1 ? '半场' : '全场',
            {
                ...score,
                id: found.match_id,
            },
        )
        result.push({
            ...score,
            match_id: match.id,
            period1: match.period1,
        })
    }

    return result
}

/**
 * 获取单场比赛的id
 * @param match_id
 */
async function getMatchScore(match_id: string): Promise<MatchScore> {
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

    //读取技术统计

    const { corner1, corner2, corner1_period1, corner2_period1 } = await getTechData(match_id)

    return {
        score1: parseInt(score1),
        score2: parseInt(score2),
        score1_period1: parseInt(score1_period1),
        score2_period1: parseInt(score2_period1),
        corner1,
        corner2,
        corner1_period1,
        corner2_period1,
    }
}

/**
 * 获取比赛数据统计
 * @param match_id
 */
async function getTechData(match_id: string): Promise<TechData> {
    await titan007Limiter.add(() => {})
    const resp = await axios.request({
        url: 'https://livestatic.titan007.com/vbsxml/detailin.js',
        params: {
            r: `007${Date.now()}`,
            id: match_id,
        },
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        responseType: 'text',
    })

    const script = `${resp.data};\nShowBf(tT_f)`

    const data = await new Promise<Record<string, any>>((resolve, reject) => {
        function ShowBf(matches: any) {
            resolve(matches)
        }
        try {
            eval(script)
        } catch (err) {
            reject(err)
        }
    })

    if (!Array.isArray(data[match_id])) {
        return await getTechDataFromHtml(match_id)
    }

    let corner1: number | null = null
    let corner2: number | null = null
    let corner1_period1: number | null = null
    let corner2_period1: number | null = null

    const row0 = data[match_id].find((t) => t[0] === 0)
    if (row0) {
        corner1 = parseInt(row0[1])
        corner2 = parseInt(row0[2])
    }

    const row1 = data[match_id].find((t) => t[0] === 1)
    if (row0) {
        corner1_period1 = parseInt(row1[1])
        corner2_period1 = parseInt(row1[2])
    }

    return {
        corner1,
        corner2,
        corner1_period1,
        corner2_period1,
    }
}

/**
 * 通过页面获取比赛数据统计
 * @param match_id
 */
async function getTechDataFromHtml(match_id: string): Promise<TechData> {
    await titan007Limiter.add(() => {})
    const resp = await axios.request({
        url: `https://live.titan007.com/detail/${match_id}sb.htm`,
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0',
        },
        responseType: 'text',
    })

    let corner1: number | null = null
    let corner2: number | null = null
    let corner1_period1: number | null = null
    let corner2_period1: number | null = null

    const $ = load(resp.data)
    const lists = $('#teamTechDiv > .lists')
    lists.each((_1, el) => {
        //通过内容判断
        const div = $(el).find('div.data')
        if (div.length === 0) return
        const label = div.find('span').eq(1).text().trim()
        if (label === '角球') {
            corner1 = parseInt(div.find('span').eq(0).text().trim())
            corner2 = parseInt(div.find('span').eq(2).text().trim())
        } else if (label === '半场角球') {
            corner1_period1 = parseInt(div.find('span').eq(0).text().trim())
            corner2_period1 = parseInt(div.find('span').eq(2).text().trim())
        }
    })

    return {
        corner1,
        corner2,
        corner1_period1,
        corner2_period1,
    }
}

/**
 * 寻找匹配的比赛
 */
function findMatch(match: BaseMatch, scoreData: Titan007MatchInfo[]) {
    const team1_name = match.team1.replace(/[()（）]|\s/g, '')
    const team2_name = match.team2.replace(/[()（）]|\s/g, '')
    const match_time = dayjs(match.match_time)

    //先寻找完全匹配的数据
    let found = scoreData.find((row) => {
        if (Math.abs(row.match_time - match_time.valueOf()) > 1800000) return false

        return team1_name === row.team1 || team2_name === row.team2
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
            if (!team1_match && !team2_match) return false
            return true
        })
    }

    return found
}

/**
 * 获取今日比赛的赛果
 */
async function getTodayMatches() {
    const finish: Titan007MatchInfo[] = []
    const period1: Titan007MatchInfo[] = []

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

    const formatMatch = (row: string[]) => {
        const dateParts = row[12].split(',')
        const time = new Date(
            Date.parse(`${dateParts[0]}/${parseInt(dateParts[1]) + 1}/${dateParts[2]} ${row[11]}`),
        )
        const team1_id = row[37]
        const team2_id = row[38]

        const result = {
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

        console.log(result.time, result.team1, result.team2)

        return result
    }

    //对比赛进行筛选，只留下完场的比赛
    matches.forEach((row) => {
        const state = parseInt(row[13])
        if (state === -1) {
            //已完场
            finish.push(formatMatch(row))
        } else if (state >= 2) {
            //半场
            period1.push(formatMatch(row))
        }
    })

    return {
        finish,
        period1,
    }
}

/**
 * 获取更早的比赛的id
 */
async function getYesterdayMatches(): Promise<Titan007MatchInfo[]> {
    await titan007Limiter.add(() => {})

    try {
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
                time = yesterday
                    .clone()
                    .hour(parseInt(match[2]))
                    .minute(parseInt(match[3]))
                    .toDate()
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
    } catch (err) {
        console.error(err)
        return []
    }
}

if (require.main === module) {
    startScoreRobot()
        //getMatchScore('2621358')
        .then((data) => {
            console.log(data)
            process.exit()
        })
        .catch((err) => {
            console.error(err)
            process.exit()
        })
}
