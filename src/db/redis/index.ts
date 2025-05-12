import { Pool } from './pool'
import { CONFIG } from '../../config'

/**
 * Redis连接池
 */
export const redis = new Pool(CONFIG.redis.connection, CONFIG.redis.pool)
