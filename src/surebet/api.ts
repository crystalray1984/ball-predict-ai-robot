import axios from 'axios'
import { RateLimiter } from '../common/rate-limiter'

export interface GetOddsOptions {
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
export async function getAllOdds(options: GetOddsOptions) {
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
