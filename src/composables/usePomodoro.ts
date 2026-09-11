/**
 * 番茄钟核心状态机（与平台无关，设计方案 4.1）。
 *
 * 关键设计：
 * - 以绝对时间戳 endAt 驱动，setInterval 只做「校对刷新」；
 * - 暂停存 remainingMs，恢复 endAt = now + remainingMs —— 进程被杀/后台冻结后依然准确；
 * - 快照每次变更即持久化，App 重启/回前台 restore() 校准，若发现已超时则补记完成；
 * - 状态迁移通过事件广播，页面可订阅刷新 UI（剩余时间依赖 pulse 保持响应式）。
 */

import { computed, reactive, ref, onUnmounted } from 'vue'
import { storage } from '@/utils/storage'
import { platform } from '@/platform'
import { useTaskStore } from '@/store/modules/task'
import { usePomodoroStore } from '@/store/modules/pomodoro'
import { focusApi } from '@/api/focus'
import type { Phase, Snapshot, PomodoroConfig } from '@/types/pomodoro'
import type { Task } from '@/types/task'

const KEY = 'pomodoro:snapshot:v1'
export const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsPerCycle: 4,
  autoStartNext: true,
}

const nextPhase = (phase: Phase, round: number, cfg: PomodoroConfig): Phase => {
  if (phase !== 'focus') return 'focus'
  return round % cfg.roundsPerCycle === 0 ? 'longBreak' : 'shortBreak'
}
const phaseSec = (phase: Phase, cfg: PomodoroConfig) =>
  (phase === 'focus' ? cfg.focusMinutes : phase === 'shortBreak' ? cfg.shortBreakMinutes : cfg.longBreakMinutes) * 60

type Listener = (s: Snapshot) => void

export function usePomodoro(config: Partial<PomodoroConfig> = {}) {
  const cfg = reactive<PomodoroConfig>({ ...DEFAULT_CONFIG, ...config })

  const s = reactive<Snapshot>({
    phase: 'focus',
    status: 'idle',
    round: 0,
    endAt: 0,
    remainingMs: 0,
    taskId: null,
    focusStartedAt: 0,
    totalFocusSec: 0,
  })

  const taskStore = useTaskStore()
  const pomodoroStore = usePomodoroStore()

  /** 每个 tick 递增，驱动依赖它的计算属性重新求值 */
  const pulse = ref(0)
  const listeners = new Map<string, Set<Listener>>()

  const on = (ev: string, fn: Listener) => {
    if (!listeners.has(ev)) listeners.set(ev, new Set())
    listeners.get(ev)!.add(fn)
  }
  const emit = (ev: string) => {
    const copy = { ...s }
    listeners.get(ev)?.forEach(fn => fn(copy))
  }
  const persist = () => {
    storage.set(KEY, JSON.stringify(s))
    pomodoroStore.saveSnapshot({ ...s })
  }
  const syncPlatform = () => {
    platform.onPhaseChange(s)
    emit('platformSync')
  }

  // ---------- 状态迁移 ----------
  const enter = (phase: Phase, round: number, autoStart = true) => {
    s.phase = phase
    s.round = round
    s.status = 'idle'
    s.endAt = 0
    s.remainingMs = 0
    s.totalFocusSec = 0
    if (autoStart) start()
    persist()
    emit('phaseChange')
    syncPlatform()
  }

  function start() {
    if (s.status === 'running') return
    const remain = s.status === 'paused' ? s.remainingMs : phaseSec(s.phase, cfg) * 1000
    s.remainingMs = 0
    s.endAt = Date.now() + remain
    s.status = 'running'
    if (s.phase === 'focus') s.focusStartedAt = Date.now()
    persist()
    emit('start')
    syncPlatform()
  }

  function pause() {
    if (s.status !== 'running') return
    s.remainingMs = Math.max(0, s.endAt - Date.now())
    s.status = 'paused'
    s.endAt = 0
    if (s.phase === 'focus' && s.focusStartedAt) {
      s.totalFocusSec += Math.round((Date.now() - s.focusStartedAt) / 1000)
      s.focusStartedAt = 0
    }
    persist()
    emit('pause')
    syncPlatform()
  }

  /** 手动放弃当前番茄（不记完成），running / paused 均支持 */
  function giveUp() {
    const runningFocus = s.phase === 'focus' && s.status === 'running'
    const sec =
      s.totalFocusSec +
      (runningFocus && s.focusStartedAt
        ? Math.round((Date.now() - s.focusStartedAt) / 1000)
        : 0)
    if (s.phase === 'focus' && sec > 0) {
      focusApi
        .record({
          kind: 'focus',
          actualSec: sec,
          completed: false,
          abandonedReason: 'give_up',
          taskId: s.taskId,
        })
        .catch(() => {
          /* 离线：TODO(M3) 入 outbox 队列 */
        })
    }
    s.status = 'idle'
    s.endAt = 0
    s.remainingMs = 0
    s.totalFocusSec = 0
    s.focusStartedAt = 0
    s.taskId = null
    persist()
    emit('giveUp')
    syncPlatform()
  }

  /** 阶段自然结束 */
  async function complete() {
    const finished = s.phase
    if (finished === 'focus') {
      const dur = phaseSec(finished, cfg)
      try {
        await focusApi.record({
          kind: 'focus',
          plannedSec: dur,
          actualSec: dur,
          completed: true,
          taskId: s.taskId,
        })
        if (s.taskId) taskStore.incDone(s.taskId)
      } catch {
        /* 离线：TODO(M3) 入 outbox 队列 */
      }
      emit('focusDone')
    }
    const newRound = finished === 'focus' ? s.round + 1 : s.round
    const np = nextPhase(finished, s.round, cfg)
    s.taskId = null
    emit('phaseDone')
    enter(np, finished === 'focus' ? newRound : s.round, cfg.autoStartNext)
  }

  // ---------- 时钟（只校对，不累减） ----------
  let timer: ReturnType<typeof setInterval> | null = null
  const tick = () => {
    if (s.status !== 'running') return
    if (s.endAt - Date.now() <= 0) {
      void complete()
      return
    }
    pulse.value++
    emit('tick')
  }
  const startClock = () => {
    if (!timer) timer = setInterval(tick, 500)
  }
  const stopClock = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // ---------- 恢复 / 校准 ----------
  function restore() {
    const raw = storage.get<string>(KEY)
    if (raw) {
      try {
        Object.assign(s, JSON.parse(raw))
      } catch {
        storage.remove(KEY)
      }
    }
    if (s.status === 'running') {
      if (s.endAt - Date.now() <= 0) void complete()
      else startClock()
    }
    emit('restore')
  }

  /** 页面 onShow 时调用 */
  function syncOnForeground() {
    if (s.status === 'running') tick()
    else startClock()
  }

  function startWithTask(task: Task | null) {
    if (s.status === 'running') return
    s.taskId = task?._id ?? null
    enter('focus', s.round + 1, true)
  }

  // ---------- 计算属性 ----------
  const remainingMs = computed(() => {
    void pulse.value
    if (s.status === 'running') return Math.max(0, s.endAt - Date.now())
    return s.remainingMs
  })
  const totalMs = computed(() => phaseSec(s.phase, cfg) * 1000)
  const progress = computed(() => {
    const remain = remainingMs.value
    const total = totalMs.value
    if (!total) return 0
    return Math.min(1, Math.max(0, 1 - remain / total))
  })

  /** 运行期更新配置（如设置页修改时长后即时生效于后续阶段） */
  function applyConfig(patch: Partial<PomodoroConfig>) {
    Object.assign(cfg, patch)
  }

  restore()
  onUnmounted(stopClock)

  return {
    s,
    cfg,
    remainingMs,
    totalMs,
    progress,
    on,
    applyConfig,
    start,
    pause,
    giveUp,
    complete,
    enter,
    startWithTask,
    restore,
    syncOnForeground,
  }
}
