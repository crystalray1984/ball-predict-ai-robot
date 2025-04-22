import { Pool } from './pool'

/**
 * Redis连接池
 */
export const redis = new Pool(
    {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
        password: process.env.REDIS_PASS,
        db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
    },
    {
        min: process.env.REDIS_POOL_MIN ? Number(process.env.REDIS_POOL_MIN) : 0,
        max: process.env.REDIS_POOL_MAX ? Number(process.env.REDIS_POOL_MAX) : 5,
    },
)
