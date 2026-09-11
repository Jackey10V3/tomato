/**
 * 本地账号（离线）：账号 / 昵称 / 密码（加盐哈希）全部保存在本机，
 * 不联网、不上传；用于区分个人档案与后续云同步的账号体系。
 * 注意：这是本地体验用的轻量实现，非安全级认证。
 */
import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'

const K_USERS = 'auth:users'
const K_SESSION = 'auth:session'

export interface LocalUser {
  account: string
  nickname: string
  hash: string
  createdAt: number
}

function hash(pwd: string): string {
  // 轻量加盐哈希（本地体验用）
  let h = 5381
  const s = `tomato::${pwd}`
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

function readUsers(): LocalUser[] {
  const raw = storage.get<string>(K_USERS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as LocalUser[]
  } catch {
    return []
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    users: readUsers(),
    account: storage.get<string>(K_SESSION) || '',
  }),

  getters: {
    isLogin: s => !!s.account,
    current: s => s.users.find(u => u.account === s.account) || null,
    displayName(s): string {
      const u = s.users.find(x => x.account === s.account)
      return u ? u.nickname : '未登录'
    },
  },

  actions: {
    persist() {
      storage.set(K_USERS, JSON.stringify(this.users))
      if (this.account) storage.set(K_SESSION, this.account)
      else storage.remove(K_SESSION)
    },
    register(payload: { account: string; password: string; nickname?: string }): { ok: boolean; msg?: string } {
      const account = payload.account.trim().toLowerCase()
      if (!/^[a-z0-9@._-]{3,}$/.test(account)) return { ok: false, msg: '账号至少 3 位（字母/数字）' }
      if (payload.password.length < 4) return { ok: false, msg: '密码至少 4 位' }
      if (this.users.some(u => u.account === account)) return { ok: false, msg: '该账号已存在' }
      this.users.push({
        account,
        nickname: payload.nickname?.trim() || `番茄${account.slice(0, 4)}`,
        hash: hash(payload.password),
        createdAt: Date.now(),
      })
      this.account = account
      this.persist()
      return { ok: true }
    },
    login(payload: { account: string; password: string }): { ok: boolean; msg?: string } {
      const account = payload.account.trim().toLowerCase()
      const u = this.users.find(x => x.account === account)
      if (!u) return { ok: false, msg: '账号不存在，请先注册' }
      if (u.hash !== hash(payload.password)) return { ok: false, msg: '密码不正确' }
      this.account = account
      this.persist()
      return { ok: true }
    },
    logout() {
      this.account = ''
      this.persist()
    },
    rename(nickname: string) {
      const u = this.current
      if (u) {
        u.nickname = nickname
        this.persist()
      }
    },
  },
})
