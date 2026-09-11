import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import type { AuthState } from '@/types/user'
import type { UserInfo } from '@/types/api'

const K_TOKEN = 'auth:token'
const K_USER = 'auth:user'

function readUser(): AuthState['user'] {
  const raw = storage.get<string>(K_USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthState['user']
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', {
  state: (): AuthState => ({
    token: storage.get<string>(K_TOKEN) || '',
    user: readUser(),
  }),

  getters: {
    isLogin: s => !!s.token,
    nickname: s => s.user?.nickname || '未登录',
  },

  actions: {
    setAuth(info: UserInfo) {
      if (info.token) {
        this.token = info.token
        storage.set(K_TOKEN, info.token)
      }
      this.user = { _id: info._id, nickname: info.nickname, avatar: info.avatar }
      storage.set(K_USER, JSON.stringify(this.user))
    },

    logout() {
      this.token = ''
      this.user = null
      storage.remove(K_TOKEN)
      storage.remove(K_USER)
    },
  },
})
