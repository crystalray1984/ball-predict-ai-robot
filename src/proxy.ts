import axios from 'axios'

/**
 * 获取代理
 */
export async function getProxy(): Promise<string | undefined> {
    if (process.env.CROWN_PROXY_URL) {
        return process.env.CROWN_PROXY_URL
    }

    if (!process.env.CROWN_PROXY) {
        return
    }

    const proxys = await axios.request<string>({
        url: process.env.CROWN_PROXY,
        responseType: 'text',
    })

    const proxy = proxys.data.split('\r\n')[0]
    return `http://${proxy}`
}
