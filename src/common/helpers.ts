/**
 * 等待指定秒数后返回的Promise
 * @param timeout
 */
export function delay(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout))
}

export function isNullOrUndefined(value: any): value is null | undefined {
    if (typeof value === 'undefined') return true
    if (value === null) return true
    return false
}

export function isEmpty(value: any) {
    if (isNullOrUndefined(value)) return true
    if (typeof value === 'string') {
        return value === ''
    }
    return false
}
