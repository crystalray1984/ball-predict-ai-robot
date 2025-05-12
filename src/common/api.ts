import axios, { AxiosRequestConfig } from 'axios'
import { CONFIG } from '../config'

const apiInstance = axios.create({
    method: 'POST',
    baseURL: CONFIG.api_url,
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
