/**
 * 等待指定秒数后返回的Promise
 * @param timeout
 */
export function delay(timeout: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeout))
}
