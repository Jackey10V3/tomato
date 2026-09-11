/**
 * 本地持久化封装：统一前缀 + try/catch。
 * 当前基于 uni.getStorageSync 的 KV 实现；
 * 若任务量达万级需要 SQLite（plus.sqlite 或 uts 插件），仅需替换本文件实现，
 * 对外保持 get/set/remove 三个方法即可，业务代码零改动。
 */
const PREFIX = 'tomato:'

export const storage = {
  get<T = string>(key: string): T | null {
    try {
      const raw = uni.getStorageSync(PREFIX + key)
      if (raw === '' || raw === null || raw === undefined) return null
      return raw as T
    } catch (e) {
      console.warn('[storage] get failed', key, e)
      return null
    }
  },

  set(key: string, value: unknown): void {
    try {
      uni.setStorageSync(PREFIX + key, value as never)
    } catch (e) {
      console.warn('[storage] set failed', key, e)
    }
  },

  remove(key: string): void {
    try {
      uni.removeStorageSync(PREFIX + key)
    } catch (e) {
      console.warn('[storage] remove failed', key, e)
    }
  },
}
