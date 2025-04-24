import axios from 'axios'
import { load } from 'cheerio'
import levenshtein from 'js-levenshtein'
import { Op } from 'sequelize'
import { RateLimiter } from './common/rate-limit'
import { Match, Team } from './db'

const titan007Limiter = new RateLimiter(1000)

/**
 * 获取球探网的比赛结果
 * @param match_id 球探网比赛id
 */
async function getScore(match_id: string) {
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
    const head = $('#headVs')
    const score1 = head.find('.score').eq(0).text()
    const score2 = head.find('.score').eq(1).text()
    const period1 = head.find('span.row').text()
    const match = /([0-9]+)-([0-9]+)/.exec(period1)!

    const corner = $('#teamTechDiv > lists').eq(0)
    const corner1 = corner.find('.data span').eq(0).text()
    const corner2 = corner.find('.data span').eq(2).text()
    const corner_period1 = $('#teamTechDiv > lists').eq(1)
    const corner1_period1 = corner_period1.find('.data span').eq(0).text()
    const corner2_period2 = corner_period1.find('.data span').eq(2).text()

    return {
        score1: parseInt(score1),
        score2: parseInt(score2),
        score1_peroid1: parseInt(match[1]),
        score2_peroid1: parseInt(match[2]),
        corner1: parseInt(corner1),
        corner2: parseInt(corner2),
        corner1_period1: parseInt(corner1_period1),
        corner2_period2: parseInt(corner2_period2),
    }
}

/**
 * 从球探网获取所有完场比赛的id
 */
async function getAllFinishMatches() {
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

    //对比赛进行筛选，只留下完场的比赛
    const filtered = matches
        .filter((row) => -1 == parseInt(row[13]))
        .map((row) => {
            const dateParts = row[12].split(',')
            const match_time = Date.parse(
                `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${row[11]}`,
            )
            return {
                match_id: row[0],
                match_time,
                team1: row[5].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/, ''),
                team2: row[8].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/, ''),
            }
        })

    return filtered
}

/**
 * 计算完成比赛的赛果
 */
async function getMatchesScore(matches: Match[]) {
    let scoreData: Awaited<ReturnType<typeof getAllFinishMatches>>
    try {
        scoreData = await getAllFinishMatches()
    } catch (err) {
        console.error(err)
        return
    }

    for (const match of matches) {
        const team1_name = match.team1.name.replace(/[()（）]|\s/, '')
        const team2_name = match.team2.name.replace(/[()（）]|\s/, '')

        //从完场比赛中找出相似度高且比赛时间高度接近的比赛
        const found = scoreData.find((row) => {
            if (Math.abs(row.match_time - match.match_time.valueOf()) > 1800000) return false
            if (levenshtein(team1_name, row.team1) > 3) return false
            if (levenshtein(team2_name, row.team2) > 3) return false
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
                    [Op.lt]: new Date(Date.now() - 7200000),
                },
                has_score: false,
            },
            include: [Team],
        })

        console.log('待计算赛果的比赛', matches.length)
        if (matches.length === 0) continue
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
