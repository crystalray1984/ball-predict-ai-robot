import { ClientContext, Redis, RedisCommander } from 'ioredis'

/**
 * 封装的Redis连接
 */
export class Connection<Context extends ClientContext = { type: 'default' }> {
    constructor(protected _commander: RedisCommander<Context>) {}
}

export interface Connection<Context extends ClientContext = { type: 'default' }>
    extends Omit<RedisCommander<Context>, 'exec' | 'quit'> {}

Object.entries(Object.getPrototypeOf(Redis.prototype)).forEach(([name, member]) => {
    if (typeof member !== 'function') return
    if (['exec', 'quit'].includes(name)) return
    if (typeof Connection.prototype[name as keyof Connection] !== 'undefined') return
    Object.defineProperty(Connection.prototype, name, {
        value: function (this: Connection, ...args: any[]) {
            const method = this._commander[name as keyof RedisCommander] as Function
            if (typeof method !== 'function') {
                throw new TypeError(`方法${method}不存在`)
            }
            return method.apply(this._commander, args)
        },
    })
})
