/** 本地时间日期工具（兼容多端，不依赖 toLocaleString 差异） */
import type { SessionKind } from '@/types/focus'

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function timeKey(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dateTimeKey(d: Date = new Date()): string {
  return `${dateKey(d)} ${timeKey(d)}`
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function formatSec(sec: number): string {
  return formatMs(sec * 1000)
}

/** 秒 → HH:MM:SS 或 MM:SS */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}时${m}分`
  if (m > 0 && ss > 0) return `${m}分${ss}秒`
  if (m > 0) return `${m}分钟`
  return `${ss}秒`
}

export function startOfDay(d: Date = new Date()): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 周几（0-6，0=周日） */
export function weekday(d: Date = new Date()): number {
  return d.getDay()
}

/** 周一的零点 */
export function mondayStart(d: Date = new Date()): number {
  const x = startOfDay(d)
  const day = new Date(x).getDay() || 7 // 周一=1…周日=7
  return x - (day - 1) * 86400000
}

/** 所属周的周一日期 key（与记录里的 dateKey 同一套字符串，可直接比较大小） */
export function mondayKey(d: Date = new Date()): string {
  return dateKey(new Date(mondayStart(d)))
}

/**
 * 前一天的日期 key。
 * 不直接用时间戳减 86400000，避免夏令时/闰秒下算错一天。
 */
export function prevDateKey(key: string): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

/**
 * 记录的归属日期：开启「午夜模式」时，凌晨 4 点前完成的专注算作前一天。
 * 统计（当日/连续天数/热力图）与写入记录时必须共用这一个口径，否则数字会互相矛盾。
 */
export function effectiveDateKey(ts: number = Date.now(), midnightAttach = false): string {
  const d = new Date(ts)
  if (midnightAttach && d.getHours() < 4) d.setDate(d.getDate() - 1)
  return dateKey(d)
}

/** 阶段中文名 */
export const KIND_LABEL: Record<SessionKind, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
}
