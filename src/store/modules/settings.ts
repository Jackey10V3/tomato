import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import { DEFAULT_SETTINGS, THEMES, type AppSettings, type SoundPrefs, type WhitelistItem } from '@/types/app'
import { setAudioVolume } from '@/utils/audioEngine'

const K = 'settings:app'

/** 不依赖 structuredClone（小程序等运行时可能缺失） */
function cloneDefault(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base
  if (Array.isArray(patch) || typeof patch !== 'object') {
    return (patch as T) ?? base
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  const p = patch as Record<string, unknown>
  for (const key of Object.keys(p)) {
    const pv = p[key]
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && out[key] && typeof out[key] === 'object') {
      out[key] = deepMerge(out[key], pv)
    } else if (pv !== undefined) {
      out[key] = pv
    }
  }
  return out as T
}

function read(): AppSettings {
  const raw = storage.get<string>(K)
  if (!raw) return cloneDefault()
  try {
    return deepMerge(cloneDefault(), JSON.parse(raw))
  } catch {
    return cloneDefault()
  }
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    s: read() as AppSettings,
  }),

  getters: {
    themeDef: st => THEMES[st.s.theme],
    timer: st => st.s.timer,
    guard: st => st.s.focusGuard,
    sounds: st => st.s.sounds,
    whitelist: st => st.s.focusGuard.whitelist,
  },

  actions: {
    persist() {
      storage.set(K, JSON.stringify(this.s))
    },
    /** 局部更新（可深层，例如 update({ timer: { focusMin: 30 } })） */
    update(patch: Partial<AppSettings> | Record<string, unknown>) {
      this.s = deepMerge(this.s, patch)
      this.persist()
    },
    setTheme(key: AppSettings['theme']) {
      this.s.theme = key
      this.persist()
    },
    updateTimer(patch: Partial<AppSettings['timer']>) {
      this.update({ timer: patch })
    },
    updateGuard(patch: Partial<AppSettings['focusGuard']>) {
      this.update({ focusGuard: patch })
    },
    setSounds(patch: Partial<SoundPrefs>) {
      this.update({ sounds: patch })
    },
    /** 深色模式（同时同步底部栏配色） */
    setDark(v: boolean) {
      this.update({ dark: v })
      this.applySideEffects()
    },
    setPoster(key: AppSettings['poster']) {
      this.update({ poster: key })
    },
    setVolume(v: number) {
      this.update({ volume: Math.min(1, Math.max(0, v)) })
      setAudioVolume(this.s.volume)
    },
    /** 应用主题/深色/音量的全局副作用（页面 onShow 调用） */
    applySideEffects() {
      setAudioVolume(this.s.volume)
      try {
        uni.setTabBarStyle({
          backgroundColor: this.s.dark ? '#1e2229' : '#FFFFFF',
          color: this.s.dark ? '#98a0ab' : '#909399',
          selectedColor: THEMES[this.s.theme].primary,
          borderStyle: this.s.dark ? 'black' : 'white',
        })
      } catch {
        /* 某些端不支持则忽略 */
      }
    },
    addWhitelist(item: WhitelistItem) {
      if (this.s.focusGuard.whitelist.some(w => w.pkg === item.pkg)) return
      this.s.focusGuard.whitelist.push(item)
      this.persist()
    },
    removeWhitelist(pkg: string) {
      this.s.focusGuard.whitelist = this.s.focusGuard.whitelist.filter(w => w.pkg !== pkg)
      this.persist()
    },
    resetAll() {
      this.s = cloneDefault()
      this.persist()
      this.applySideEffects()
    },
    // ---------- 备份 / 恢复 ----------
    exportAll() {
      return this.s
    },
    replaceAll(obj: Partial<AppSettings>) {
      this.s = deepMerge(cloneDefault(), obj)
      this.persist()
      this.applySideEffects()
    },
  },
})
