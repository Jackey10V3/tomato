/**
 * HTTP 请求封装（uni.request）。
 * BASE 默认指向本地后端 http://127.0.0.1:3000/api/v1；
 * H5 联调可通过 .env 的 VITE_API_BASE 覆盖（真机调试时指向局域网 IP）。
 */

import type { ApiResponse } from '@/types/api'
import { storage } from '@/utils/storage'

export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || 'http://127.0.0.1:3000/api/v1'

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  /** 是否携带 token，默认 true */
  auth?: boolean
  /** 是否显示加载提示 */
  loading?: boolean
  /** 超时（毫秒），默认 15s。弱网下不再无限等待 */
  timeout?: number
}

/**
 * 并发 loading 计数：
 * 原先两个请求同时 loading:true 时，先返回的那个 hideLoading 会把另一个的转圈也关掉。
 * 用计数保证「最后一个结束的请求」才关闭。
 */
let loadingCount = 0
function showLoading() {
  loadingCount += 1
  if (loadingCount === 1) uni.showLoading({ title: '加载中', mask: true })
}
function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) uni.hideLoading()
}

export function request<T>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true, loading = false, timeout = 15000 } = options
  if (loading) showLoading()

  return new Promise<T>((resolve, reject) => {
    const header: Record<string, string> = { 'content-type': 'application/json' }
    if (auth) {
      const token = storage.get<string>('auth:token')
      if (token) header.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: url.startsWith('http') ? url : BASE_URL + url,
      method,
      data: data as never,
      header,
      timeout,
      success: res => {
        if (loading) hideLoading()
        const body = res.data as ApiResponse<T> | undefined
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new ApiError(body?.code ?? res.statusCode, body?.message || '请求失败'))
        }
      },
      fail: err => {
        if (loading) hideLoading()
        const msg = err.errMsg || ''
        // 超时与网络不可达给不同提示，便于排查"后端没启动还是网络不通"
        reject(new ApiError(-1, msg.includes('timeout') ? '请求超时，请检查网络' : '网络错误，请确认后端已启动' ))
      },
    })
  })
}

export const http = {
  get: <T>(url: string, opts?: Partial<RequestOptions>) =>
    request<T>({ url, ...opts }),
  post: <T>(url: string, data?: unknown, opts?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'POST', data, ...opts }),
  put: <T>(url: string, data?: unknown, opts?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'PUT', data, ...opts }),
  del: <T>(url: string, opts?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'DELETE', ...opts }),
}
