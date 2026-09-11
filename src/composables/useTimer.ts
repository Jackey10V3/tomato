/**
 * 专注计时核心（单例）：
 * - 倒计时 / 正向计时双模式；
 * - 严格模式：专注进行中禁止暂停/手动结束/放弃（放行与否由返回值体现）；
 * - 学霸模式离席检测：notifyLeft/notifyBack，累计警告达阈值或单次超时 → 自动判定放弃；
 * - 阶段衔接与结算：自然完成=completed 并累加任务番茄；手动结束=manual；放弃=giveup；学霸作废=abandoned；
 * - 快照持久化 + 绝对时间戳，App 被杀/切后台恢复后依然准确，倒计时超时自动补记。
 *
 * 使用：任意页面 setup 内调用 useTimer() 均获得同一个会话实例（模块级单例），
 * 因此「任务页 ▶ 开番茄」与「专注页展示」共享状态。
 */

import { computed, reactive, ref } from 'vue'
import { storage } from '@/utils/storage'
import { effectiveDateKey } from '@/utils/date'
import { useSettingsStore } from '@/store/modules/settings'
import { useTaskStore } from '@/store/modules/task'
import { useFocusStore, MIN_STAT_SEC } from '@/store/modules/focus'
import { playEffect } from '@/utils/audioEngine'
import { platform } from '@/platform'
import type { SessionKind, TimerMode } from '@/types/focus'

type SettingsStore = ReturnType<typeof useSettingsStore>
type TaskStore = ReturnType<typeof useTaskStore>
type FocusStore = ReturnType<typeof useFocusStore>

export type TimerStatus = 'idle' | 'running' | 'paused'

export interface LeaveReport {
  warnIndex: number
  leaveSec: number
  penalized: boolean
  reason?: string
}

interface SnapshotV2 {
  kind: SessionKind
  mode: TimerMode
  status: TimerStatus
  round: number
  taskId?: string
  taskTitle?: string
  pausedElapsed: number
  segStart: number
  targetMs: number
  /** 本轮计划时长（秒）——任务自定义时长会覆盖全局设置，结算时用它而非全局默认值 */
  plannedSec: number
  strict: boolean
  studyHard: boolean
  leaveTimes: number
  /** 自然结束后是否自动衔接休息（仅经典专注页为 true；二级单任务计时 false） */
  autoBreak: boolean
}

const KEY = 'timer:snapshot:v2'
const EMPTY: SnapshotV2 = {
  kind: 'focus', mode: 'countdown', status: 'idle', round: 0,
  pausedElapsed: 0, segStart: 0, targetMs: 0, plannedSec: 0, strict: false, studyHard: false, leaveTimes: 0, autoBreak: true,
}

// ---------------- 模块级状态（单例） ----------------
const st = reactive<SnapshotV2>({ ...EMPTY })
const pulse = ref(0)
const leaveStart = ref(0)
const listeners = new Map<string, Set<(payload?: unknown) => void>>()

let bound: { settings: SettingsStore | null; tasks: TaskStore | null; focus: FocusStore | null } = {
  settings: null, tasks: null, focus: null,
}
let clock: ReturnType<typeof setInterval> | null = null
/** 已解锁成就 id 快照（用于提示“新解锁”） */
let earnedIds: string[] = []
/** 上次等级（用于升级提示） */
let lastLevel = 1

type StoreModuleName = never
type StoreOf<T> = T

const on = (ev: string, fn: (payload?: unknown) => void) => {
  if (!listeners.has(ev)) listeners.set(ev, new Set())
  listeners.get(ev)!.add(fn)
}
const off = (ev: string, fn: (payload?: unknown) => void) => {
  listeners.get(ev)?.delete(fn)
}
const emit = (ev: string, payload?: unknown) => listeners.get(ev)?.forEach(fn => fn(payload))

/** 提交后检查新成就 / 升级 */
function syncAchievements() {
  const f = bound.focus
  if (!f) return
  const nowIds = f.achievements.filter(a => a.earned).map(a => a.id)
  const fresh = nowIds.filter(id => !earnedIds.includes(id))
  if (fresh.length) emit('achievement', fresh)
  earnedIds = nowIds

  const lv = f.levelInfo.level
  if (lv > lastLevel) emit('levelup', { level: lv, title: f.levelInfo.title })
  lastLevel = lv
}

const running = () => st.status === 'running'
const isFocus = () => st.kind === 'focus'
const isStrictFocus = () => isFocus() && st.strict && st.status !== 'idle'

function secFor(kind: SessionKind): number {
  const t = bound.settings?.s.timer
  const min = kind === 'focus' ? t?.focusMin ?? 25 : kind === 'shortBreak' ? t?.shortMin ?? 5 : t?.longMin ?? 15
  return min * 60
}

function persist() {
  storage.set(KEY, JSON.stringify({ ...st }))
}

function recordDateKey(ts: number): string {
  // 与统计口径共用同一个函数：开启午夜模式时凌晨 4 点前的专注归到前一天
  return effectiveDateKey(ts, bound.settings?.s.midnightAttach ?? false)
}

function commit(kind: SessionKind, actualSec: number, result: 'completed' | 'manual' | 'giveup' | 'abandoned', leaveTimes: number, reason?: string) {
  const startedAt = Date.now() - actualSec * 1000
  bound.focus?.add({
    kind,
    mode: st.mode,
    plannedSec: st.plannedSec > 0 ? Math.round(st.plannedSec) : secFor(kind),
    actualSec: Math.round(actualSec),
    result,
    taskId: st.taskId,
    taskTitle: st.taskTitle,
    strict: st.strict,
    studyHard: st.studyHard,
    leaveTimes,
    dateKey: recordDateKey(startedAt),
    startedAt,
    endedAt: Date.now(),
  })
}

/**
 * 把计时状态同步给原生层：运行中防息屏 + 通知栏进度，暂停/结束时收尾。
 * H5 端 keepAlive/notify 为空实现，此处调用无副作用。
 */
function syncPlatform() {
  if (st.status === 'running') {
    platform.keepAlive.start()
    const remainMin = st.mode === 'countdown' ? Math.max(1, Math.ceil((st.targetMs - elapsedRaw()) / 60000)) : 0
    platform.notify.show(st.kind === 'focus' ? '专注中' : '休息中', remainMin > 0 ? `还剩 ${remainMin} 分钟` : '正向计时中')
  } else {
    platform.keepAlive.stop()
    platform.notify.clear()
  }
}

function playBy(key: 'start' | 'end' | 'warn' | 'giveup') {
  const s = bound.settings?.s.sounds
  const kind =
    key === 'start' ? s?.start : key === 'end' ? s?.end : key === 'giveup' ? s?.giveup : s?.warn
  // 触感与声音解耦：声音选"静音"时依然保留振动提醒（设置项默认开启）
  if (bound.settings?.s.vibrate) {
    if (key === 'warn' || key === 'giveup') platform.haptic.heavy()
    else platform.haptic.light()
  }
  playEffect(kind ?? 'none', key === 'warn' ? 'warn' : key === 'end' ? 'end' : 'start')
}

function setIdle() {
  st.status = 'idle'
  st.pausedElapsed = 0
  st.segStart = 0
  syncPlatform()
  emit('idle')
}

export interface StartOptions {
  taskId?: string
  taskTitle?: string
  mode?: TimerMode
  minutes?: number
  guard?: { strict?: boolean; studyHard?: boolean }
  round?: number
}

function startKind(kind: SessionKind, opts: StartOptions = {}) {
  const guard = bound.settings?.s.focusGuard
  st.kind = kind
  st.mode = opts.mode ?? bound.settings?.s.defaultMode ?? 'countdown'
  st.round = opts.round ?? st.round
  st.taskId = opts.taskId
  st.taskTitle = opts.taskTitle
  // 正向计时无自然终点，严格模式会让它无法收场 → 强制不随严格
  const strictWanted = opts.guard?.strict ?? guard?.strict ?? false
  st.strict = st.mode === 'countup' ? false : strictWanted
  st.studyHard = opts.guard?.studyHard ?? guard?.studyHard ?? false
  // 目标时长：倒计时可被任务覆盖为自定义分钟
  let minutes = secFor(kind) / 60
  if (kind === 'focus' && st.mode === 'countdown' && opts.minutes && opts.minutes > 0) {
    minutes = opts.minutes
  }
  st.targetMs = minutes * 60 * 1000
  st.plannedSec = st.targetMs / 1000
  // 显式指定了 mode（二级单任务计时）→ 结束后不自动衔接休息
  st.autoBreak = opts.mode === undefined
  st.status = 'running'
  st.segStart = Date.now()
  st.pausedElapsed = 0
  st.leaveTimes = 0
  if (kind === 'focus') st.round += 1
  persist()
  syncPlatform()
  emit('phaseChange')
  playBy('start')
}

// ---------------- 阶段迁移 ----------------
function startFocus(opts: StartOptions = {}) {
  startKind('focus', opts)
}
function pause(): boolean {
  if (st.status !== 'running') return false
  if (isStrictFocus()) return false
  st.pausedElapsed += Date.now() - st.segStart
  st.segStart = 0
  st.status = 'paused'
  persist()
  syncPlatform()
  emit('pause')
  return true
}
function resume(): boolean {
  if (st.status !== 'paused') return false
  st.status = 'running'
  st.segStart = Date.now()
  persist()
  syncPlatform()
  emit('resume')
  return true
}
function finishSuccess(): boolean {
  if (st.status === 'idle') return false
  if (isStrictFocus()) return false
  const actual = Math.max(60, Math.round(elapsedRaw() / 1000))
  const kind = st.kind
  if (kind === 'focus') {
    commit('focus', actual, 'manual', 0)
    // 低于 3 分钟不计入统计，也不累加任务的番茄进度
    if (st.taskId && actual >= MIN_STAT_SEC) bound.tasks?.incDone(st.taskId)
    syncAchievements()
    playBy('end')
  }
  setIdle()
  emit('finished')
  return true
}
function giveUp(): boolean {
  if (st.status === 'idle') return false
  if (isStrictFocus()) return false
  const actual = Math.round(elapsedRaw() / 1000)
  commit(st.kind, actual, 'giveup', 0)
  playBy('giveup')
  setIdle()
  emit('giveup')
  return true
}
/** 休息/正向计时「跳过」或自然完成后回到待机 */
function endCurrent(kind: SessionKind) {
  const actual = Math.max(1, Math.round(elapsedRaw() / 1000))
  commit(kind, actual, 'manual', 0)
  setIdle()
  emit('finished')
}

function finishNatural(): void {
  const kind = st.kind
  const actual = st.targetMs / 1000
  if (kind === 'focus') {
    commit('focus', actual, 'completed', 0)
    if (st.taskId) bound.tasks?.incDone(st.taskId)
    syncAchievements()
    playBy('end')
    emit('focusDone')
    if (st.autoBreak && bound.settings?.s.timer.autoStartNext) {
      nextRest()
    } else {
      setIdle()
      emit('finished')
    }
  } else {
    commit(kind, actual, 'completed', 0)
    playBy('end')
    setIdle()
    emit('restDone')
    emit('finished')
  }
}

function nextRest() {
  const t = bound.settings?.s.timer
  const rounds = t?.roundsPerCycle ?? 4
  const kind: SessionKind = st.round > 0 && st.round % rounds === 0 ? 'longBreak' : 'shortBreak'
  st.taskId = undefined
  st.taskTitle = undefined
  startKind(kind, { round: st.round })
}

// ---------------- 学霸模式 ----------------
function notifyLeft() {
  if (!running() || !isFocus()) return
  if (!st.studyHard) return
  if (leaveStart.value === 0) leaveStart.value = Date.now()
}
function notifyBack(): LeaveReport | null {
  if (!st.studyHard || leaveStart.value === 0) return null
  const sec = Math.round((Date.now() - leaveStart.value) / 1000)
  leaveStart.value = 0
  const guard = bound.settings?.s.focusGuard
  st.leaveTimes += 1
  const warnIndex = st.leaveTimes
  if (sec >= (guard?.leaveGraceSec ?? 60) || warnIndex >= (guard?.warnLimit ?? 3)) {
    const actual = Math.round(elapsedRaw() / 1000)
    commit('focus', actual, 'abandoned', warnIndex, 'leave')
    playBy('warn')
    setIdle()
    st.leaveTimes = 0
    emit('abandoned')
    return {
      warnIndex,
      leaveSec: sec,
      penalized: true,
      reason: sec >= (guard?.leaveGraceSec ?? 60) ? '单次离开过久，本次专注作废' : `离席警告达到 ${warnIndex} 次，本次专注作废`,
    }
  }
  playBy('warn')
  persist()
  return { warnIndex, leaveSec: sec, penalized: false }
}

// ---------------- 时钟 / 派生 ----------------
function elapsedRaw(): number {
  return st.pausedElapsed + (running() ? Date.now() - st.segStart : 0)
}

function tick() {
  if (!running()) return
  if (st.mode === 'countdown' && st.targetMs - elapsedRaw() <= 0) {
    finishNatural()
    return
  }
  pulse.value++
}
function startClockOnce() {
  if (clock) return
  // UI 只展示到「秒」，1Hz 足够；原先 250ms 会让整机在专注期间持续 4 倍重渲染
  clock = setInterval(tick, 1000)
}

const remainingMs = computed(() => {
  void pulse.value
  return st.mode === 'countdown' ? Math.max(0, st.targetMs - elapsedRaw()) : 0
})
const elapsedMs = computed(() => {
  void pulse.value
  return Math.max(0, elapsedRaw())
})
const progress = computed(() => {
  const e = elapsedMs.value
  return Math.min(1, e / Math.max(1, st.targetMs))
})
const bigText = computed(() => {
  void pulse.value
  const total = st.mode === 'countdown' ? Math.max(0, Math.ceil(remainingMs.value / 1000)) : Math.floor(elapsedMs.value / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (st.mode === 'countup' && h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function restore() {
  const raw = storage.get<string>(KEY)
  if (raw) {
    try {
      Object.assign(st, JSON.parse(raw) as SnapshotV2)
    } catch {
      storage.remove(KEY)
    }
  }
  if (st.status === 'running' && st.segStart > 0) {
    const remain = st.mode === 'countdown' ? st.targetMs - (st.pausedElapsed + Date.now() - st.segStart) : Number.POSITIVE_INFINITY
    if (remain <= 0) {
      // 后台已自然结束：按计划补记
      const kind = st.kind
      const sec = st.targetMs / 1000
      st.status = 'idle'
      st.pausedElapsed = 0
      st.segStart = 0
      if (kind === 'focus') {
        commit('focus', sec, 'completed', 0)
        if (st.taskId) bound.tasks?.incDone(st.taskId)
        emit('focusDone')
        emit('finished')
      } else {
        commit(kind, sec, 'completed', 0)
        emit('finished')
      }
      persist()
    }
  } else if (st.status !== 'running') {
    storage.remove(KEY)
  }
  // App 重启/重新进入时，若仍有进行中的会话，重新拉起防息屏与通知
  if (st.status === 'running') syncPlatform()
}

/** 页面 setup 中调用以获得全局会话 */
export function useTimer() {
  const settings = useSettingsStore()
  const tasks = useTaskStore()
  const focus = useFocusStore()
  bound = { settings, tasks, focus }
  startClockOnce()
  if (firstBind) {
    firstBind = false
    earnedIds = focus.achievements.filter(a => a.earned).map(a => a.id)
    lastLevel = focus.levelInfo.level
    restore()
  }
  return {
    st,
    on,
    off,
    remainingMs,
    elapsedMs,
    progress,
    bigText,
    isFocus,
    isStrictFocus,
    startFocus,
    startKind,
    pause,
    resume,
    finishSuccess,
    giveUp,
    endCurrent,
    notifyLeft,
    notifyBack,
    leaveStart,
  }
}
let firstBind = true
