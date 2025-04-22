import { pick } from 'lodash'
import { Op } from 'sequelize'
import { redis, Setting } from '../db'

/**
 * 系统配置的Redis缓存键名
 */
export const CACHE_SETTING_KEY = 'settings'

/**
 * 重构配置数据缓存
 */
async function refreshSettings() {
    const rows = await Setting.findAll()
    const cacheData = Object.fromEntries(rows.map((row) => [row.name, row.value]))
    const client = await redis.multi()
    await client.del(CACHE_SETTING_KEY).hmset(CACHE_SETTING_KEY, cacheData).exec()

    return Object.fromEntries(
        rows.map((row) => [row.name, row.value ? JSON.parse(row.value) : undefined]),
    )
}

/**
 * 读取系统配置
 * @param key 要读取的配置键名
 */
export function getSetting<T>(key: string): Promise<T | undefined>
export function getSetting<T extends string>(
    key1: T,
    key2: T,
    ...keys: T[]
): Promise<Record<T, any>>
export async function getSetting(...keys: string[]): Promise<any> {
    if (keys.length === 0) return

    //尝试通过缓存读取
    const cache = await redis.run(async (client) => {
        if (!(await client.exists(CACHE_SETTING_KEY))) {
            return false
        }

        //读取缓存数据
        return await client.hmget(CACHE_SETTING_KEY, ...keys)
    })

    if (cache !== false) {
        //缓存有数据
        if (keys.length === 1) {
            return cache[0] ? JSON.parse(cache[0]) : undefined
        } else {
            return Object.fromEntries(
                keys.map((key, index) => [
                    key,
                    cache[index] ? JSON.parse(cache[index]) : undefined,
                ]),
            )
        }
    }

    //重建缓存
    const allData = await refreshSettings()

    if (keys.length === 1) {
        return allData[keys[0]]
    } else {
        return pick(allData, keys)
    }
}

/**
 * 不通过缓存读取配置数据
 * @param key
 */
function withoutCache<T>(key: string): Promise<T | undefined>
/**
 * 不通过缓存读取配置数据
 * @param key1
 * @param key2
 * @param keys
 */
function withoutCache<T extends string>(key1: T, key2: T, ...keys: T[]): Promise<Record<T, any>>
async function withoutCache(key: string, ...keys: string[]): Promise<any> {
    if (keys.length === 0) {
        //读取单个配置
        const row = await Setting.findOne({
            where: {
                name: key,
            },
        })
        if (!row || !row.value) return
        return JSON.parse(row.value)
    } else {
        //读取多个配置
        const rows = await Setting.findAll({
            where: {
                name: {
                    [Op.in]: [key, ...keys],
                },
            },
        })
        if (rows.length === 0) {
            return {}
        }
        return Object.fromEntries(
            rows.map((row) => [row.name, row.value ? JSON.parse(row.value) : undefined]),
        )
    }
}

getSetting.withoutCache = withoutCache

/**
 * 设置系统配置
 * @param name 配置名
 * @param value 配置值
 */
export function setSetting(name: string, value: any): Promise<void>
/**
 * 设置系统配置
 * @param data 需更新的配置数据
 */
export function setSetting(data: Record<string, any>): Promise<void>
export async function setSetting(data: string | Record<string, any>, value?: any) {
    if (typeof data === 'string') {
        data = {
            [data]: value,
        }
    }

    //构建更新数据
    const entries = Object.entries(data)
    for (const [name, rawValue] of entries) {
        let value: string
        if (
            typeof rawValue === 'function' ||
            typeof rawValue === 'symbol' ||
            typeof rawValue === 'undefined' ||
            rawValue === null
        ) {
            value = ''
        } else {
            value = JSON.stringify(rawValue)
        }

        await Setting.upsert({ name, value }, { returning: false })
    }

    //重构缓存
    await refreshSettings()
}
