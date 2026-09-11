import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import type { Snapshot } from '@/types/pomodoro'

const K_SNAPSHOT = 'pomodoro:snapshot:v1'

const EMPTY: Snapshot = {
  phase: 'focus',
  status: 'idle',
  round: 0,
  endAt: 0,
  remainingMs: 0,
  taskId: null,
  focusStartedAt: 0,
  totalFocusSec: 0,
}

function readSnapshot(): Snapshot {
  const raw = storage.get<string>(K_SNAPSHOT)
  if (!raw) return { ...EMPTY }
  try {
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Snapshot>) }
  } catch {
    return { ...EMPTY }
  }
}

/**
 * 番茄钟快照的跨页面镜像（如 tabBar 角标 / 首页卡片展示）。
 * 注意：真正的计时状态机在 composables/usePomodoro.ts（单页实例持有），
 * 两者通过本 store 的 saveSnapshot 保持同步展示。
 */
export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    snapshot: readSnapshot(),
  }),

  actions: {
    saveSnapshot(s: Snapshot) {
      this.snapshot = { ...s }
      storage.set(K_SNAPSHOT, JSON.stringify(this.snapshot))
    },
    reset() {
      this.snapshot = { ...EMPTY }
      storage.remove(K_SNAPSHOT)
    },
  },
})
