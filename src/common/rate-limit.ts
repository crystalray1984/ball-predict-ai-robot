import { Queue } from './queue'

/**
 * 限制了执行频率的队列
 */
export class RateLimiter extends Queue {
    /**
     * 允许执行下一个任务的时间
     */
    protected nextRunTime = 0

    /**
     *
     * @param interval 两次任务之间的执行间隔
     */
    constructor(public interval: number) {
        super(1)
    }

    add<T>(task: () => Promise<T> | T): Promise<T> {
        //对任务进行封装
        const wrappedTask = async (): Promise<T> => {
            const now = Date.now()
            if (now < this.nextRunTime) {
                await new Promise<void>((resolve) => setTimeout(resolve, this.nextRunTime - now))
            }
            this.nextRunTime = Date.now() + this.interval
            return task()
        }

        return super.add(wrappedTask)
    }
}

const _rateLimiters: Record<string, RateLimiter> = {}

/**
 * 获取全局的频率限制队列
 * @param name
 * @param interval
 */
export function getRateLimiter(name: string, interval: number): RateLimiter {
    if (!(_rateLimiters[name] instanceof RateLimiter)) {
        _rateLimiters[name] = new RateLimiter(interval)
    }
    return _rateLimiters[name]
}
