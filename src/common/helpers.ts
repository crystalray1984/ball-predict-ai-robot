/**
 * 等待指定秒数后返回的Promise
 * @param timeout
 */
export function delay(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout))
}

const _singletons: Record<string | symbol, () => any> = {}

/**
 * 执行一项单例任务
 * @param name 任务标识
 * @param task 任务
 */
export function singleton<T>(name: string | symbol, task: () => T): T {
    if (typeof _singletons[name] === 'function') {
        return _singletons[name]()
    }

    const result = task()
    if (result instanceof Promise) {
        _singletons[name] = () => result
        result.finally(() => {
            delete _singletons[name]
        })
    }
    return result
}
