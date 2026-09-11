import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import { uuid } from '@/utils/uuid'
import { useSettingsStore } from '@/store/modules/settings'
import { dateKey, effectiveDateKey, mondayKey, parseDateKey, prevDateKey } from '@/utils/date'
import type {
  AchievementDef,
  DayStat,
  FocusRecord,
  LevelInfo,
  SummaryStats,
} from '@/types/focus'

const K = 'focus:records:v1'

/** 已解锁成就（id → 解锁时间戳）。成就一旦拿到就不该丢，所以单独持久化。 */
const UNLOCK_K = 'focus:achievements:v1'

/** 计入统计的最短专注时长（秒）：低于该值不计入统计（仍保留在历史流水） */
export const MIN_STAT_SEC = 180

/** 该记录是否计入统计：专注 + 完成/手动结束 + 达到最短时长 */
export function countsInStats(r: FocusRecord): boolean {
  return r.kind === 'focus' && r.actualSec >= MIN_STAT_SEC && (r.result === 'completed' || r.result === 'manual')
}

/** 是否属于「过短、不计入统计」的记录（用于界面标注） */
export function isTooShort(r: FocusRecord): boolean {
  return r.kind === 'focus' && r.actualSec < MIN_STAT_SEC && (r.result === 'completed' || r.result === 'manual')
}

/**
 * 兼容旧版本数据：早期记录可能缺少 dateKey / result / 数值字段，
 * 直接进统计页会在 `.startsWith()`、除以 undefined 等处抛错导致白屏。
 * 这里统一补齐（只补缺失字段，不改动已有值）。
 */
function normalizeRecord(raw: unknown): FocusRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const startedAt = Number(r.startedAt) || Number(r.endedAt) || Number(r.createdAt) || Date.now()
  const endedAt = Number(r.endedAt) || startedAt
  const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
  const completed = r.completed === undefined ? true : !!r.completed
  const result = (r.result as FocusRecord['result']) || (completed ? 'completed' : 'giveup')
  return {
    _id: String(r._id || uuid()),
    kind: (r.kind as FocusRecord['kind']) || 'focus',
    mode: (r.mode as FocusRecord['mode']) || 'countdown',
    plannedSec: num(r.plannedSec),
    actualSec: num(r.actualSec),
    result,
    taskId: r.taskId ? String(r.taskId) : undefined,
    taskTitle: r.taskTitle ? String(r.taskTitle) : undefined,
    strict: !!r.strict,
    studyHard: !!r.studyHard,
    leaveTimes: num(r.leaveTimes),
    // 没有 dateKey 的旧记录按开始时间补算（与写入口径一致，不做午夜偏移）
    dateKey: typeof r.dateKey === 'string' && r.dateKey ? r.dateKey : dateKey(new Date(startedAt)),
    startedAt,
    endedAt,
    createdAt: num(r.createdAt, endedAt),
  }
}

function read(): FocusRecord[] {
  const raw = storage.get<string>(K)
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as unknown[]
    if (!Array.isArray(list)) return []
    return list.map(normalizeRecord).filter((x): x is FocusRecord => !!x)
  } catch {
    return []
  }
}

function readUnlocked(): Record<string, number> {
  const raw = storage.get<string>(UNLOCK_K)
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as Record<string, number>
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

/**
 * 统计用的「今天」：与写入记录时的归属口径完全一致（含午夜模式）。
 * 全部统计都必须走这里，否则凌晨的专注会在不同数字里归到不同天。
 */
function effectiveToday(): string {
  const s = useSettingsStore()
  return effectiveDateKey(Date.now(), s.s.midnightAttach)
}

/** 有效专注：完成/手动结束，且达到最短时长（≥3 分钟）才计入统计 */
function isEffective(r: FocusRecord): boolean {
  return countsInStats(r)
}
function isAbandoned(r: FocusRecord): boolean {
  return r.kind === 'focus' && r.result === 'abandoned'
}
/** 主动放弃（giveup）——之前完全没被统计到，导致「完成率」虚高 */
function isGiveup(r: FocusRecord): boolean {
  return r.kind === 'focus' && r.result === 'giveup'
}

/** 把一条记录累加进某个日统计 */
function accumulate(stat: DayStat, r: FocusRecord): void {
  if (isEffective(r)) {
    stat.pomodoros += 1
    stat.focusMinutes += r.actualSec / 60
  } else if (isAbandoned(r)) {
    stat.abandoned += 1
  } else if (isGiveup(r)) {
    stat.abandoned += 1
  }
}

export function emptyDay(): DayStat {
  return { dateKey: dateKey(), pomodoros: 0, focusMinutes: 0, abandoned: 0 }
}

export function summarizeDay(records: FocusRecord[], key: string): DayStat {
  const stat = emptyDay()
  stat.dateKey = key
  records.forEach(r => {
    if (r.dateKey !== key) return
    accumulate(stat, r)
  })
  stat.focusMinutes = Math.round(stat.focusMinutes)
  return stat
}

/**
 * 连续打卡天数。
 * 只统计「有效专注」（≥3 分钟且完成/手动结束）的日子——与 activeDays、成就口径一致；
 * 之前把 10 秒就放弃的记录也算打卡，会出现"连续 30 天"却没有任何有效专注的假数据。
 * @param todayKey 由调用方按午夜模式给出，保证跨零点归属一致
 */
export function calcStreak(records: FocusRecord[], todayKey: string = dateKey()): number {
  const days = new Set(records.filter(r => isEffective(r)).map(r => r.dateKey))
  if (!days.size) return 0
  let cursor = todayKey
  // 今天还没专注时从昨天起算，保留"连续进行中"的观感
  if (!days.has(cursor)) cursor = prevDateKey(cursor)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = prevDateKey(cursor)
  }
  return streak
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- 番茄数量 ----
  { id: 'p1', icon: '🍅', title: '第一颗番茄', desc: '完成第一个番茄钟', tier: 'bronze', goal: 1, progress: s => s.totalPomodoros },
  { id: 'p10', icon: '🏅', title: '渐入佳境', desc: '累计完成 10 个番茄', tier: 'bronze', goal: 10, progress: s => s.totalPomodoros },
  { id: 'p25', icon: '🎖️', title: '小有所成', desc: '累计完成 25 个番茄', tier: 'bronze', goal: 25, progress: s => s.totalPomodoros },
  { id: 'p50', icon: '🥇', title: '专注达人', desc: '累计完成 50 个番茄', tier: 'silver', goal: 50, progress: s => s.totalPomodoros },
  { id: 'p100', icon: '💯', title: '百分专注', desc: '累计完成 100 个番茄', tier: 'gold', goal: 100, progress: s => s.totalPomodoros },
  { id: 'p200', icon: '👑', title: '两百之约', desc: '累计完成 200 个番茄', tier: 'gold', goal: 200, progress: s => s.totalPomodoros },
  { id: 'p365', icon: '🌌', title: '番茄之年', desc: '累计完成 365 个番茄', tier: 'diamond', goal: 365, progress: s => s.totalPomodoros },

  // ---- 专注时长 ----
  { id: 'h1', icon: '⏱️', title: '专注一小时', desc: '累计专注 1 小时', tier: 'bronze', goal: 60, progress: s => s.totalFocusMinutes },
  { id: 'h5', icon: '⏳', title: '时间的朋友', desc: '累计专注 5 小时', tier: 'bronze', goal: 300, progress: s => s.totalFocusMinutes },
  { id: 'h10', icon: '🕙', title: '十时有成', desc: '累计专注 10 小时', tier: 'silver', goal: 600, progress: s => s.totalFocusMinutes },
  { id: 'h25', icon: '🕰️', title: '一日之功', desc: '累计专注 25 小时', tier: 'silver', goal: 1500, progress: s => s.totalFocusMinutes },
  { id: 'h50', icon: '🌗', title: '半百小时', desc: '累计专注 50 小时', tier: 'gold', goal: 3000, progress: s => s.totalFocusMinutes },
  { id: 'h100', icon: '🏔️', title: '百小时攀登', desc: '累计专注 100 小时', tier: 'gold', goal: 6000, progress: s => s.totalFocusMinutes },
  { id: 'h300', icon: '🛰️', title: '三百小时', desc: '累计专注 300 小时', tier: 'diamond', goal: 18000, progress: s => s.totalFocusMinutes },

  // ---- 连续打卡 ----
  { id: 's3', icon: '🔥', title: '三日之火', desc: '连续专注 3 天', tier: 'bronze', goal: 3, progress: s => s.streakDays },
  { id: 's7', icon: '⚡', title: '一周坚持', desc: '连续专注 7 天', tier: 'bronze', goal: 7, progress: s => s.streakDays },
  { id: 's14', icon: '🌠', title: '半月不倒', desc: '连续专注 14 天', tier: 'silver', goal: 14, progress: s => s.streakDays },
  { id: 's30', icon: '🌋', title: '月级自律', desc: '连续专注 30 天', tier: 'gold', goal: 30, progress: s => s.streakDays },
  { id: 's100', icon: '🏛️', title: '百日筑基', desc: '连续专注 100 天', tier: 'diamond', goal: 100, progress: s => s.streakDays },
  { id: 'days30', icon: '📆', title: '三十日足迹', desc: '累计打卡 30 天（可不连续）', tier: 'silver', goal: 30, progress: s => s.activeDays },

  // ---- 单日 / 单次强度 ----
  { id: 'today5', icon: '🌞', title: '今日小胜', desc: '单日完成 5 个番茄', tier: 'bronze', goal: 5, progress: s => s.today.pomodoros },
  { id: 'today10', icon: '🌻', title: '单日爆发', desc: '单日完成 10 个番茄', tier: 'silver', goal: 10, progress: s => s.today.pomodoros },
  { id: 'todayMin120', icon: '🧱', title: '两小时硬核', desc: '单日专注满 120 分钟', tier: 'silver', goal: 120, progress: s => s.today.focusMinutes },
  { id: 'long60', icon: '🧘', title: '一小时不断线', desc: '单次专注 ≥ 60 分钟', tier: 'gold', goal: 60, progress: s => s.maxSessionMinutes },

  // ---- 习惯 / 态度 ----
  { id: 'early', icon: '🌅', title: '早起鸟', desc: '在早上 7 点前开始专注 5 次', tier: 'silver', goal: 5, progress: s => s.earlySessions },
  { id: 'night', icon: '🌙', title: '夜猫子', desc: '在 23 点后专注 5 次', tier: 'silver', goal: 5, progress: s => s.nightSessions },
  { id: 'noGiveup', icon: '🛡️', title: '说到做到', desc: '完成 20 个番茄且零放弃', tier: 'gold', goal: 20, progress: s => (s.abandonedTotal === 0 && s.giveupTotal === 0 ? s.totalPomodoros : 0) },
  { id: 'collector', icon: '🧩', title: '专注收藏家', desc: '累计 300 次专注记录', tier: 'diamond', goal: 300, progress: s => s.totalSessions },
]

/** 经验：番茄为主，时长与连续打卡加成 */
export function xpOf(s: SummaryStats): number {
  return s.totalPomodoros * 10 + Math.floor(s.totalFocusMinutes / 5) + s.streakDays * 5
}

export const LEVEL_TITLES = [
  '番茄新手', '专注学徒', '自律练习生', '时间管理者', '专注达人',
  '心流探索者', '深度工作者', '自律大师', '番茄宗师', '传说专注者',
]

/** 由经验换算等级（每级所需经验递增 25%） */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1
  let base = 0
  let need = 100
  while (xp >= base + need) {
    base += need
    level += 1
    need = Math.round(need * 1.25)
  }
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xp,
    curBase: base,
    nextXp: base + need,
    progress: Math.min(1, Math.max(0, (xp - base) / need)),
  }
}

export const useFocusStore = defineStore('focus', {
  state: () => ({
    records: read() as FocusRecord[],
    /** 已解锁成就 id → 时间戳（持久化，解锁后不会因当日数据变化而丢失） */
    unlocked: readUnlocked() as Record<string, number>,
  }),

  getters: {
    /** 统计用的「今天」（含午夜模式），页面与其它 getter 都应使用它 */
    todayKey(): string {
      return effectiveToday()
    },
    /** 时间轴（新→旧） */
    timeline(st): FocusRecord[] {
      return [...st.records].sort((a, b) => b.startedAt - a.startedAt)
    },
    byDateKey(st) {
      return (key: string) => st.records.filter(r => r.dateKey === key)
    },
    today(): DayStat {
      return summarizeDay(this.records, effectiveToday())
    },
    thisWeek(): DayStat {
      // 用 dateKey 区间（字符串直接比较）而不是 startedAt 时间戳，
      // 这样开启午夜模式后跨零点的专注会和"当日"统计归到同一天
      const tk = effectiveToday()
      const mk = mondayKey(parseDateKey(tk))
      const total: DayStat = { dateKey: 'week', pomodoros: 0, focusMinutes: 0, abandoned: 0 }
      this.records.forEach(r => {
        if (r.dateKey < mk || r.dateKey > tk) return
        accumulate(total, r)
      })
      total.focusMinutes = Math.round(total.focusMinutes)
      return total
    },
    summary(): SummaryStats {
      const focus = this.records.filter(r => r.kind === 'focus')
      let totalPomodoros = 0
      let totalFocusMinutes = 0
      let abandonedTotal = 0
      let giveupTotal = 0
      let maxSessionMinutes = 0
      let earlySessions = 0
      let nightSessions = 0
      let qualified = 0
      const daySet = new Set<string>()
      focus.forEach(r => {
        if (isEffective(r)) {
          qualified += 1
          daySet.add(r.dateKey)
          totalPomodoros += 1
          totalFocusMinutes += r.actualSec / 60
          const m = r.actualSec / 60
          if (m > maxSessionMinutes) maxSessionMinutes = m
          const h = new Date(r.startedAt).getHours()
          if (h < 7) earlySessions += 1
          if (h >= 23) nightSessions += 1
        } else if (isAbandoned(r)) {
          abandonedTotal += 1
        } else if (isGiveup(r)) {
          giveupTotal += 1
        }
      })
      return {
        today: this.today,
        week: this.thisWeek,
        totalPomodoros,
        totalFocusMinutes: Math.round(totalFocusMinutes),
        streakDays: calcStreak(this.records, effectiveToday()),
        totalSessions: qualified,
        abandonedTotal,
        giveupTotal,
        maxSessionMinutes: Math.round(maxSessionMinutes),
        earlySessions,
        nightSessions,
        activeDays: daySet.size,
      }
    },
    achievements(): (AchievementDef & { earned: boolean; cur: number; unlockedAt: number })[] {
      const s = this.summary
      return ACHIEVEMENTS.map(a => {
        // progress 只算一次（原先调两次，每次都是一遍全量统计）
        const cur = a.progress(s)
        return {
          ...a,
          cur: Math.min(a.goal, cur),
          // 已解锁的成就永久保留：像"单日 10 个番茄""零放弃"这类条件
          // 用实时数据判断会导致第二天/下一次放弃时"掉档"
          earned: !!this.unlocked[a.id] || cur >= a.goal,
          unlockedAt: this.unlocked[a.id] || 0,
        }
      })
    },
    earnedCount(): number {
      return this.achievements.filter(a => a.earned).length
    },
    /** 经验值 */
    xp(): number {
      return xpOf(this.summary)
    },
    /** 等级信息（等级/称号/经验进度） */
    levelInfo(): LevelInfo {
      return levelFromXp(this.xp)
    },
    /** 近 n 天热力点（含今天，锚点与统计口径一致） */
    lastDaysHeat() {
      return (n: number) => {
        const out: { dateKey: string; minutes: number; count: number; abandoned: number }[] = []
        let key = effectiveToday()
        const keys: string[] = []
        for (let i = 0; i < n; i++) {
          keys.unshift(key)
          key = prevDateKey(key)
        }
        keys.forEach(k => {
          const st = summarizeDay(this.records, k)
          out.push({ dateKey: k, minutes: st.focusMinutes, count: st.pomodoros, abandoned: st.abandoned })
        })
        return out
      }
    },
    /** 某月日历热力（含前后补齐空格；第 1 列从周日开始） */
    monthHeat() {
      return (year: number, month: number) => {
        // month: 1-12
        const first = new Date(year, month - 1, 1)
        const daysInMonth = new Date(year, month, 0).getDate()
        const lead = first.getDay() // 0=周日
        const cells: ({ day: number | null; minutes: number; count: number } | null)[] = []
        for (let i = 0; i < lead; i++) cells.push(null)
        for (let day = 1; day <= daysInMonth; day++) {
          const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const st = summarizeDay(this.records, key)
          cells.push({ day, minutes: st.focusMinutes, count: st.pomodoros })
        }
        while (cells.length % 7 !== 0) cells.push(null)
        return cells
      }
    },
    /** 最近12个月专注分钟（年视图） */
    yearBars() {
      const bars: { label: string; minutes: number }[] = []
      const d = new Date()
      for (let i = 11; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
        const y = m.getFullYear()
        const mo = m.getMonth() + 1
        const prefix = `${y}-${String(mo).padStart(2, '0')}`
        let minutes = 0
        this.records.forEach(r => {
          if (isEffective(r) && (r.dateKey || '').startsWith(prefix)) minutes += r.actualSec / 60
        })
        bars.push({ label: `${mo}月`, minutes: Math.round(minutes) })
      }
      return bars
    },
  },

  actions: {
    add(rec: Omit<FocusRecord, '_id' | 'createdAt'>): FocusRecord {
      const full: FocusRecord = { ...rec, _id: uuid(), createdAt: Date.now() }
      this.records.push(full)
      this.persist()
      // 每次产生记录后立刻结算成就并持久化，避免"解锁过又被收回"
      this.syncUnlocks()
      return full
    },
    /** 检查是否有新解锁的成就并落盘（返回本次新解锁的 id） */
    syncUnlocks(): string[] {
      const s = this.summary
      const fresh: string[] = []
      ACHIEVEMENTS.forEach(a => {
        if (this.unlocked[a.id]) return
        if (a.progress(s) >= a.goal) {
          this.unlocked[a.id] = Date.now()
          fresh.push(a.id)
        }
      })
      if (fresh.length) storage.set(UNLOCK_K, JSON.stringify(this.unlocked))
      return fresh
    },
    removeById(id: string) {
      this.records = this.records.filter(r => r._id !== id)
      this.persist()
    },
    clearAll() {
      this.records = []
      storage.remove(K)
    },
    // ---------- 备份 / 恢复 ----------
    exportAll() {
      return this.records
    },
    importAll(records: FocusRecord[]) {
      if (Array.isArray(records)) {
        this.records = records.map(normalizeRecord).filter((x): x is FocusRecord => !!x)
        this.persist()
      }
    },
    persist() {
      storage.set(K, JSON.stringify(this.records))
    },
  },
})

export { dateKey, parseDateKey }
