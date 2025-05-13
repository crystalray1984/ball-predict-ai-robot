import { ConfirmChannel, connect, ConsumeMessage } from 'amqplib'
import { CONFIG } from '../config'

interface ConsumerOptions {
    queue: string
    prefetchCount?: number
    onMessage: (msg: ConsumeMessage) => void | Promise<void>
}

/**
 * 开启队列消费者
 * @param queue
 * @param prefetchCount
 */
export async function startConsumer(options: ConsumerOptions): Promise<void> {
    const conn = await connect(CONFIG.rabbitmq)

    try {
        //开启通道
        const channel = await conn.createChannel()

        //初始化队列信息
        try {
            await channel.assertQueue(options.queue)
            await channel.prefetch(options.prefetchCount ?? 1)

            //开启队列消费者
            await new Promise<void>((resolve, reject) => {
                let consumeTag: string

                channel
                    .consume(options.queue, async (msg) => {
                        if (!msg) {
                            reject(new Error('rabbitmq服务器断开连接'))
                            return
                        }

                        try {
                            await options.onMessage(msg)
                            channel.ack(msg)
                        } catch (err) {
                            console.error(err)
                            channel.nack(msg)
                        }
                    })
                    .then((reply) => {
                        consumeTag = reply.consumerTag
                    })
                    .catch(reject)
            })
        } finally {
            await channel.close()
        }
    } finally {
        await conn.close()
    }
}

/**
 * 队列发布者
 */
export interface Publisher {
    publish(queue: string, content: string): Promise<void>
    close(): Promise<void>
}

/**
 * 开启队列发布者
 * @param assertQueues 需要预先准备的队列
 */
export async function startPublisher(...assertQueues: string[]): Promise<Publisher> {
    const conn = await connect(CONFIG.rabbitmq)
    let channel: ConfirmChannel
    try {
        channel = await conn.createConfirmChannel()

        try {
            for (const queueName of assertQueues) {
                await channel.assertQueue(queueName)
            }
        } catch (err) {
            await channel.close()
            throw err
        }
    } catch (err) {
        await conn.close()
        throw err
    }

    const close = async () => {
        try {
            await channel.close()
        } catch {}
        try {
            await conn.close()
        } catch {}
    }

    const publish = (queue: string, msg: string) => {
        return new Promise<void>((resolve, reject) => {
            channel.sendToQueue(queue, Buffer.from(msg, 'utf-8'), {}, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    return {
        publish,
        close,
    }
}
