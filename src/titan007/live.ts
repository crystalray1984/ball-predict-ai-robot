import axios from 'axios'
import { loadDoc, titan007Limiter, USER_AGENT } from './common'
import { Dayjs } from 'dayjs'

/**
 * 获取今日比赛的列表
 */
export async function getTodayMatches() {
    await titan007Limiter.next()

    //读取赛程列表
    const resp = await axios.request({
        url: 'https://livestatic.titan007.com/vbsxml/bfdata_ut.js',
        params: {
            r: `007${Date.now()}`,
        },
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent': USER_AGENT,
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

    await titan007Limiter.next()
    //处理名称翻译
    const respAlias = await axios.request({
        url: `https://livestatic.titan007.com/vbsxml/alias3.txt`,
        params: {
            r: `007${Date.now()}`,
        },
        headers: {
            Referer: 'https://live.titan007.com/oldIndexall.aspx',
            'User-Agent': USER_AGENT,
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

    const formatMatch = (row: string[]): Titan007.MatchInfo => {
        const date_sl = row[11].split(':')
        const date_sl2 = row[36].split('-')
        const time = new Date(
            parseInt(row[43]),
            parseInt(date_sl2[0]) - 1,
            parseInt(date_sl2[1]),
            parseInt(date_sl[0]),
            parseInt(date_sl[1]),
            0,
            0,
        )

        const team1_id = row[37]
        const team2_id = row[38]

        const result = {
            match_id: row[0],
            match_time: time.valueOf(),
            team1_id,
            team1:
                alias[team1_id] ??
                row[5].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/g, ''),
            team2_id,
            team2:
                alias[team2_id] ??
                row[8].replace(/<font.+?<\/font>/i, '').replace(/[()（）]|\s/g, ''),
            state: parseInt(row[13]),
        }

        return result
    }

    return matches.map(formatMatch).filter((t) => !!t)
}

/**
 * 读取指定日期的完场赛果
 * @param date
 */
export async function getFinalMatches(day: Dayjs): Promise<Titan007.MatchInfo[]> {
    const lastDate = day.clone().add(-1, 'day')
    await titan007Limiter.add(() => {})

    try {
        //读取赛程列表
        const $ = await loadDoc(
            `https://bf.titan007.com/football/hg/Over_${day.format('YYYYMMDD')}.htm?finCookie=1`,
            undefined,
            'GBK',
        )

        const list = $('#table_live').find('tr[sid]')

        const output: Titan007.MatchInfo[] = []

        const length = list.length
        for (let i = 0; i < length; i++) {
            const tr = list.eq(i)

            //判断是否完场
            const stateStr = tr.find('td').eq(2).text().trim()
            if (stateStr !== '完') continue

            //解析时间
            const timeStr = tr.find('td').eq(1).text()
            const match = /([0-9]+)日([0-9]+):([0-9]+)/.exec(timeStr)
            if (!match) continue
            const date = parseInt(match[1])
            let time: Date
            if (date === day.date()) {
                //今天
                time = day.clone().hour(parseInt(match[2])).minute(parseInt(match[3])).toDate()
            } else {
                //昨天
                time = lastDate.clone().hour(parseInt(match[2])).minute(parseInt(match[3])).toDate()
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
                match_time: time.valueOf(),
                team1,
                team2,
                state: -1,
                team1_id: '',
                team2_id: '',
            })
        }
        return output
    } catch (err) {
        console.error(err)
        return []
    }
}
