import { connect } from 'amqplib'
import '../config'

export interface Publisher {
    publish: (queue: string, content: string) => Promise<void>
    close: () => Promise<void>
}

/**
 * 创建向消息队列发布信息的发布器
 */
export async function createPublisher(): Promise<Publisher> {
    const connection = await connect({
        hostname: process.env.MQ_HOSTNAME,
        port: process.env.MQ_PORT ? parseInt(process.env.MQ_PORT) : undefined,
        username: process.env.MQ_USERNAME,
        password: process.env.MQ_PASSWORD,
        heartbeat: 25,
    })

    const closeConnection = async () => {
        try {
            await connection.close()
        } catch {}
    }

    try {
        const channel = await connection.createConfirmChannel()

        const onError = async () => {
            try {
                await channel.close()
            } catch {}
            await closeConnection()
        }

        const assertedQueues: string[] = []

        const publish = async (queue: string, content: string) => {
            try {
                if (!assertedQueues.includes(queue)) {
                    await channel.assertQueue(queue)
                    assertedQueues.push(queue)
                }
                await new Promise<void>((resolve, reject) => {
                    channel.sendToQueue(queue, Buffer.from(content, 'utf-8'), {}, (err, ok) => {
                        if (ok) {
                            resolve()
                        } else {
                            reject(err)
                        }
                    })
                })
            } catch (err) {
                await onError()
                throw err
            }
        }

        const close = onError

        return {
            publish,
            close,
        }
    } catch (err) {
        await closeConnection()
        throw err
    }
}

export type QueueCallback = (content: string) => void | any

/**
 * 创建消息队列监听器
 * @param queue
 */
export async function startConsumer(queue: string, callback: QueueCallback) {
    const connection = await connect({
        hostname: process.env.MQ_HOSTNAME,
        port: process.env.MQ_PORT ? parseInt(process.env.MQ_PORT) : undefined,
        username: process.env.MQ_USERNAME,
        password: process.env.MQ_PASSWORD,
        heartbeat: 25,
    })
    try {
        const channel = await connection.createChannel()
        await channel.prefetch(1)
        await channel.assertQueue(queue)
        await new Promise<void>((_, reject) => {
            channel.consume(queue, async (msg) => {
                if (!msg) {
                    reject(new Error('rabbitmq服务器断开连接'))
                    return
                }

                const content = msg.content.toString('utf-8')

                try {
                    await callback(content)
                    channel.ack(msg)
                } catch (err) {
                    console.error(err)
                    channel.nack(msg)
                }
            })
        })
    } catch (err) {
        try {
            await connection.close()
        } catch {}
        throw err
    }
}
