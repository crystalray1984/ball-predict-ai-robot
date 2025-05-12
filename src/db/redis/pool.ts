import { createPool, Pool as GenericPool, Options as PoolOptions } from 'generic-pool'
import Redis, { Callback, RedisCommander, RedisOptions } from 'ioredis'
import { Connection } from './connection'

/**
 * 连接池中的连接
 */
class PoolConnection extends Connection {
    constructor(
        protected _redis: Redis,
        protected _pool: GenericPool<Redis>,
    ) {
        super(_redis)
    }

    /**
     * 释放连接
     */
    async release() {
        await this._pool.release(this._redis)
    }
}

/**
 * 由连接池发起了`multi`命令后的连接
 */
class PoolMultiConnection extends Connection<{ type: 'pipeline' }> {
    constructor(
        protected _redis: Redis,
        protected _pool: GenericPool<Redis>,
    ) {
        super(_redis.multi())
    }

    async exec(callback?: Callback<[error: Error | null, result: unknown][] | null>) {
        try {
            return await this._redis.exec(callback)
        } finally {
            await this._pool.release(this._redis)
        }
    }
}

/**
 * 连接池
 */
export class Pool {
    /**
     * 池实例
     */
    protected _pool: GenericPool<Redis>

    constructor(
        protected _redisOptions: RedisOptions,
        poolOptions?: PoolOptions,
    ) {
        this._pool = createPool(
            {
                create: () => this.getConnection(),
                destroy: async (redis) => {
                    try {
                        await redis.quit()
                    } finally {
                        redis.disconnect(false)
                    }
                },
            },
            poolOptions,
        )
    }

    run(): Promise<PoolConnection>
    run<T>(scope: (connection: Connection) => Promise<T> | T): Promise<T>
    async run(scope?: (connection: Connection) => any) {
        const client = await this._pool.acquire()
        if (typeof scope !== 'function') {
            return new PoolConnection(client, this._pool)
        }
        try {
            const connection = new Connection(client)
            return await scope(connection)
        } finally {
            await this._pool.release(client)
        }
    }

    /**
     * 创建一个独立的Redis连接
     */
    async getConnection() {
        const redis = new Redis(this._redisOptions)
        return redis
    }

    async multi() {
        const client = await this._pool.acquire()
        return new PoolMultiConnection(client, this._pool)
    }
}

export interface Pool extends Omit<RedisCommander, 'multi' | 'exec' | 'quit'> {}
Object.entries(Object.getPrototypeOf(Redis.prototype)).forEach(([name, member]) => {
    if (typeof member !== 'function') return
    if (['multi', 'exec', 'quit'].includes(name)) return
    if (typeof Pool.prototype[name as keyof Pool] !== 'undefined') return
    Object.defineProperty(Pool.prototype, name, {
        value: function (this: Pool, ...args: any[]) {
            return this.run((conn) => {
                const method = conn[name as keyof Connection] as Function
                return method.apply(conn, args)
            })
        },
    })
})
