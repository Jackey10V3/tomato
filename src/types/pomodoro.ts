export type Phase = 'focus' | 'shortBreak' | 'longBreak'
export type Status = 'idle' | 'running' | 'paused'

export interface PomodoroConfig {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** 每 N 个专注进入一次长休息 */
  roundsPerCycle: number
  autoStartNext: boolean
}

/** 计时快照（持久化到本地，进程被杀后可恢复） */
export interface Snapshot {
  phase: Phase
  status: Status
  /** 当前/已完成的第几个专注 */
  round: number
  /** 本阶段结束时间戳(ms)，running 时有效 */
  endAt: number
  /** paused 时的剩余毫秒 */
  remainingMs: number
  taskId: string | null
  /** 当前运行段起点（用于累计实际专注秒） */
  focusStartedAt: number
  /** 本阶段已累计专注秒（中途放弃时记录用） */
  totalFocusSec: number
}

export const PHASE_LABEL: Record<Phase, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
}
