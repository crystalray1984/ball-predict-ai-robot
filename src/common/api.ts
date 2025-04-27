import axios, { AxiosRequestConfig } from 'axios'
import '../config'

const apiInstance = axios.create({
    method: 'POST',
    baseURL: process.env.API_BASE,
})

/**
 * 调用接口
 * @param config
 * @returns
 */
export async function api<T = void>(config: AxiosRequestConfig & { url: string }) {
    const resp = await apiInstance.request<ApiResp<T>>(config)
    return resp.data
}
