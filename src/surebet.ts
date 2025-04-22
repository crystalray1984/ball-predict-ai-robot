import axios from 'axios'
import { RateLimiter } from './common/rate-limit'
import { getSetting } from './common/settings'
import Decimal from 'decimal.js'

interface GetOddsOptions {
    /**
     * 调用接口获取到的token
     */
    token: string
    /**
     * 指针
     */
    cursor?: string
    /**
     * 其他参数
     */
    [name: string]: any
}

/**
 * 从surebets获取单页推荐盘口
 */
async function getOdds(options: GetOddsOptions) {
    const { token, ...params } = options
    const resp = await axios.get<Surebet.OddsResp>('https://api.apostasseguras.com/request', {
        params,
        paramsSerializer: (params) => {
            const search = new URLSearchParams()
            Object.entries(params).forEach(([name, value]) => {
                if (typeof value === 'string' || typeof value === 'number') {
                    search.append(name, String(value))
                }
            })
            return search.toString()
        },
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    return resp.data
}

/**
 * 从surebets获取全部推荐盘口
 */
async function getAllOdds(options: GetOddsOptions) {
    //创建一个限制请求频率的限制器
    const limiter = new RateLimiter(500)

    let cursor: string | undefined = undefined

    const records: Surebet.OddsRecord[] = []

    //循环查询
    while (true) {
        const resp = await limiter.add(() =>
            getOdds({
                ...options,
                cursor,
            }),
        )

        if (!Array.isArray(resp.records)) {
            break
        }

        records.push(...resp.records)

        if (!resp.can_forward) break

        const last = resp.records[resp.records.length - 1]
        cursor = `${last.sort_by}:${last.id}`
    }

    //返回所有的盘口数据
    return records
}

/**
 * 获取surebet数据
 */
export async function getSurebets() {
    //构建请求surebet的数据
    const options: GetOddsOptions = {
        token: process.env.SUREBET_TOKEN!,
        product: 'surebets',
        source: '188bet|bet365',
        sport: 'Football',
        limit: 100,
        oddsFormat: 'eu',
        outcomes: '2',
        'min-profit': '-0.25',
        'max-profit': '10',
        'hide-different-rules': 'True',
        startOf: 'PT3M',
        endOf: 'PT16H',
    }

    //获取所有的推荐盘口数据
    const records = await getAllOdds(options)

    const outupt: Surebet.OutputData[] = []

    const min_surebet_value = (await getSetting('min_surebet_value')) as string

    //对盘口进行筛选
    for (const record of records) {
        //只筛选188bet的数据
        const odd = record.prongs.find((t) => t.bk === '188bet')
        if (!odd) continue

        //数据过滤，只留下需要的盘口
        let pass = false

        //全场让球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'goal' &&
            odd.type.period === 'regularTime' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场大小球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'goal' &&
            odd.type.period === 'regularTime' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场角球让球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'corner' &&
            odd.type.period === 'regularTime' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //全场角球大小球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'corner' &&
            odd.type.period === 'regularTime' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场让球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'goal' &&
            odd.type.period === 'period1' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场大小球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'goal' &&
            odd.type.period === 'period1' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场角球让球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'corner' &&
            odd.type.period === 'period1' &&
            ['ah1', 'ah2'].includes(odd.type.type)
        ) {
            pass = true
        }

        //上半场角球大小球
        if (
            odd.type.game === 'regular' &&
            odd.type.base === 'overall' &&
            odd.type.variety === 'corner' &&
            odd.type.period === 'period1' &&
            ['over', 'under'].includes(odd.type.type)
        ) {
            pass = true
        }

        //赔率大于指定的值
        if (Decimal(odd.value).gte(min_surebet_value)) {
            pass = true
        }

        if (!pass) continue

        //把数据放到返回数组中
        outupt.push({
            crown_match_id: odd.preferred_nav.markers.eventId,
            match_time: odd.time,
            type: odd.type,
            surebet_value: String(odd.value),
        })
    }

    return outupt
}
