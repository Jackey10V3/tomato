/** 用户账号类型（与 store/modules/user.ts 共享） */
export interface AuthState {
  token: string
  user: {
    _id: string
    nickname: string
    avatar?: string
  } | null
}
