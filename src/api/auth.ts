/** 账号接口 */

import { http } from './http'
import type { LoginPayload, UserInfo } from '@/types/api'

export const authApi = {
  register(payload: LoginPayload): Promise<UserInfo> {
    return http.post<UserInfo>('/auth/register', payload)
  },
  login(payload: LoginPayload): Promise<UserInfo> {
    return http.post<UserInfo>('/auth/login', payload)
  },
  me(): Promise<UserInfo> {
    return http.get<UserInfo>('/auth/me')
  },
}
