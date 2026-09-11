/** 服务端统一响应包裹 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface Page<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface UserInfo {
  _id: string
  nickname: string
  avatar?: string
  token?: string
}

export interface LoginPayload {
  account: string
  password: string
}
