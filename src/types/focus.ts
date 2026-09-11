/** 专注计时与流水类型（本地存储核心） */

/** 计时模式：倒计时 / 正向计时 */
export type TimerMode = 'countdown' | 'countup'

export type SessionKind = 'focus' | 'shortBreak' | 'longBreak'

/** 一次专注/休息的结局 */
export type SessionResult = 'completed' | 'giveup' | 'abandoned' | 'manual'

export interface FocusRecord {
  _id: string
  kind: SessionKind
  mode: TimerMode
  /** 计划时长（秒），倒计时有意义；正向计时常为自定义目标时长 */
  plannedSec: number
  /** 实际专注（秒） */
  actualSec: number
  /** completed=完整跑完；giveup=手动放弃；abandoned=学霸模式判定放弃；manual=手动结束计为完成 */
  result: SessionResult
  taskId?: string
  taskTitle?: string
  /** 本次是否开启严格/学霸模式 */
  strict: boolean
  studyHard: boolean
  /** 学霸模式下累计离席警告次数 */
  leaveTimes: number
  /** 归属日期（YYYY-MM-DD，受「午夜模式」影响可归到前一天） */
  dateKey: string
  startedAt: number
  endedAt: number
  createdAt: number
}

export interface FocusSessionConfig {
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  roundsPerCycle: number
  autoStartNext: boolean
  /** 阶段时长（秒）便捷换算 */
}

/** 统计聚合项 */
export interface DayStat {
  dateKey: string
  /** 完成的番茄数 */
  pomodoros: number
  /** 专注总分钟（只算完成+手动结束的 focus） */
  focusMinutes: number
  /** 放弃次数 */
  abandoned: number
}

export interface SummaryStats {
  today: DayStat
  /** 本周（周一起） */
  week: DayStat
  totalPomodoros: number
  totalFocusMinutes: number
  /** 连续打卡天数（连续且有「有效专注」的天数） */
  streakDays: number
  totalSessions: number
  abandonedTotal: number
  /** 主动放弃次数（giveup） */
  giveupTotal: number
  /** 单次最长专注（分钟） */
  maxSessionMinutes: number
  /** 早起专注次数（7 点前开始） */
  earlySessions: number
  /** 深夜专注次数（23 点后开始） */
  nightSessions: number
  /** 打卡总天数 */
  activeDays: number
}

export interface AchievementDef {
  id: string
  icon: string
  title: string
  desc: string
  /** 徽章等级：青铜 / 白银 / 黄金 / 钻石 */
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  /** 解锁目标值（用于展示进度 x/目标） */
  goal: number
  /** 当前进度值 */
  progress: (s: SummaryStats) => number
}

export const TIER_META: Record<AchievementDef['tier'], { label: string; color: string }> = {
  bronze: { label: '青铜', color: '#cd7f32' },
  silver: { label: '白银', color: '#9aa4b2' },
  gold: { label: '黄金', color: '#e0a800' },
  diamond: { label: '钻石', color: '#4fc3f7' },
}

/** 等级体系：每级所需经验递增，等级名称逐级进阶 */
export interface LevelInfo {
  level: number
  title: string
  xp: number
  /** 当前等级起始 xp */
  curBase: number
  /** 下一等级所需 xp */
  nextXp: number
  /** 0-1 进度 */
  progress: number
}
