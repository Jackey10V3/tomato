/**
 * 账号体系：本地档案 + 服务端账号。
 *
 * 本地部分（离线可用）：账号 / 昵称 / 密码哈希保存在本机，不联网。
 * 服务端部分：登录成功后**同时**换取服务端 JWT 并存到 `auth:token`，
 *   这是网络层（api/http.ts）读取 Authorization 的唯一来源。
 *   原实现只写本地档案、从不写 token，于是所有需要鉴权的接口
 *   （自习室 / 云同步）一律 401，表现为"明明登录了却提示未登录"。
 */
import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import { http, ApiError } from '@/api/http'
import { logError } from '@/utils/debugLog'

const K_USERS = 'auth:users'
const K_SESSION = 'auth:session'
/** 服务端 JWT 的存储键——与 api/http.ts 约定一致，勿改 */
export const K_TOKEN = 'auth:token'

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
    /** 服务端 JWT（网络层从这里读）；空 = 仅本地登录，云端功能不可用 */
    serverToken: storage.get<string>(K_TOKEN) || '',
  }),

  getters: {
    isLogin: s => !!s.account,
    /** 云端是否可用（已拿到服务端 token） */
    serverReady: s => !!s.serverToken,
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
    setToken(token: string) {
      this.serverToken = token
      if (token) storage.set(K_TOKEN, token)
      else storage.remove(K_TOKEN)
    },
    /**
     * 换取服务端 token（登录/注册后调用）。
     * 先按已有账号登录；服务端没有该账号（401/404）再尝试注册。
     * 服务器不可达时**不阻断**本地使用，只返回失败原因供页面提示。
     */
    async syncServer(password: string): Promise<{ ok: boolean; msg?: string }> {
      const account = this.account
      if (!account) return { ok: false, msg: '未登录' }
      try {
        const r = await http.post<{ token?: string }>('/auth/login', { account, password }, { auth: false })
        if (r?.token) {
          this.setToken(r.token)
          return { ok: true }
        }
        return { ok: false, msg: '服务端未返回 token' }
      } catch (e) {
        const code = e instanceof ApiError ? e.code : -1
        // 服务端没有该账号 → 用同样的账号密码注册
        if (code === 401 || code === 404) {
          try {
            const r = await http.post<{ token?: string }>(
              '/auth/register',
              { account, password, nickname: this.current?.nickname },
              { auth: false },
            )
            if (r?.token) {
              this.setToken(r.token)
              return { ok: true }
            }
            return { ok: false, msg: '服务端未返回 token' }
          } catch (e2) {
            const c2 = e2 instanceof ApiError ? e2.code : -1
            if (c2 === 400) return { ok: false, msg: '云端要求密码至少 6 位' }
            logError('auth.syncServer.register', e2)
            return { ok: false, msg: '云端注册失败' }
          }
        }
        logError('auth.syncServer.login', e)
        return { ok: false, msg: code === -1 ? '服务器未连接' : '云端登录失败' }
      }
    },
    register(payload: { account: string; password: string; nickname?: string }): { ok: boolean; msg?: string } {
      const account = payload.account.trim().toLowerCase()
      if (!/^[a-z0-9@._-]{3,}$/.test(account)) return { ok: false, msg: '账号至少 3 位（字母/数字）' }
      // 与云端规则对齐（服务端也要求 ≥6），否则本地能注册、云端却注册失败
      if (payload.password.length < 6) return { ok: false, msg: '密码至少 6 位' }
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
      this.setToken('')
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
