import { ChannelModel, connect, Options } from 'amqplib'
import '../config'
import { singleton } from './helpers'

let connection = null as unknown as ChannelModel
const assertedQueues: string[] = []

/**
 * 准备好客户端连接
 */
async function ready() {
    if (connection) return
    return singleton('rabbitmq_connection', async () => {
        connection = await connect({
            hostname: process.env.MQ_HOSTNAME,
            port: process.env.MQ_PORT ? parseInt(process.env.MQ_PORT) : undefined,
            username: process.env.MQ_USERNAME,
            password: process.env.MQ_PASSWORD,
            heartbeat: 25,
        })
        console.log('[rabbitmq]', '开启客户端连接', process.env.MQ_HOSTNAME)
    })
}

/**
 * 关闭客户端连接
 */
export async function close() {
    if (!connection) return
    await connection.close()
    assertedQueues.splice(0, assertedQueues.length)
    console.log('[rabbitmq]', '关闭客户端连接')
}

/**
 * 发布数据到消息队列
 * @param queue
 * @param content
 * @param options
 * @param forceAssert
 */
export function publish(
    queue: string,
    content: string | string[],
    options?: Options.Publish,
    forceAssert?: boolean,
): Promise<void>
/**
 * 发布数据到消息队列
 * @param queue
 * @param content
 * @param options
 * @param forceAssert
 */
export function publish(
    queue: string,
    content: string | string[],
    forceAssert?: boolean,
): Promise<void>
/**
 * 发布数据到消息队列
 * @param queue
 * @param content
 * @param options
 * @param forceAssert
 */
export async function publish(
    queue: string,
    content: string | string[],
    options?: Options.Publish | boolean,
    forceAssert?: boolean,
) {
    if (typeof options === 'boolean') {
        forceAssert = options
        options = undefined
    }
    await ready()
    const channel = await connection.createConfirmChannel()
    try {
        if (!assertedQueues.includes(queue) || forceAssert) {
            await channel.assertQueue(queue)
        }
        if (!assertedQueues.includes(queue)) {
            assertedQueues.push(queue)
        }
        if (Array.isArray(content)) {
            content.forEach((data) =>
                channel.sendToQueue(queue, Buffer.from(data, 'utf-8'), options),
            )
        } else {
            channel.sendToQueue(queue, Buffer.from(content, 'utf-8'), options)
        }
        await channel.waitForConfirms()
    } finally {
        await channel.close()
    }
}

/**
 * 开启队列消费
 * @param queue
 * @param callback
 * @param options
 */
export function consume(
    queue: string,
    callback: (content: string) => any,
    options?: Options.Consume,
): [Promise<void>, () => void] {
    const controller = new AbortController()
    const close = () => controller.abort()

    const promise = (async () => {
        await ready()
        if (controller.signal.aborted) return
        const channel = await connection.createChannel()
        try {
            if (controller.signal.aborted) return
            await channel.prefetch(1)
            if (controller.signal.aborted) return
            await new Promise<void>(async (resolve, reject) => {
                const { consumerTag } = await channel.consume(
                    queue,
                    async (msg) => {
                        if (!msg) {
                            reject(new Error('rabbitmq服务器已断开连接'))
                            return
                        }
                        try {
                            await callback(msg.content.toString('utf-8'))
                            channel.ack(msg)
                        } catch (err) {
                            console.error(err)
                            channel.nack(msg)
                        }
                    },
                    options,
                )
                console.log('[rabbitmq]', '开启队列监听', queue)
                if (controller.signal.aborted) {
                    await channel.cancel(consumerTag)
                    resolve()
                } else {
                    controller.signal.onabort = async () => {
                        await channel.cancel(consumerTag)
                        resolve()
                    }
                }
            })
        } finally {
            await channel.close()
        }
    })()
    return [promise, close]
}
