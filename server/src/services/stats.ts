import mongoose, { type PipelineStage } from 'mongoose'
import { FocusRecord } from '../models/focusRecord'
import { TZ_OFFSET_MINUTES } from '../config/env'
import { dateKeyOf } from './dateKey'

export interface HeatPoint {
  date: string // YYYY-MM-DD
  minutes: number
}

function offsetTz(): string {
  const m = TZ_OFFSET_MINUTES
  const sign = m >= 0 ? '+' : '-'
  const abs = Math.abs(m)
  const h = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${h}:${mm}`
}

/** 热力图：按天聚合专注秒数 */
export async function heatmap(uid: string, from: number, to: number): Promise<HeatPoint[]> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(uid),
        kind: 'focus',
        startedAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: offsetTz() } },
        minutes: { $sum: { $divide: ['$actualSec', 60] } },
      },
    },
    { $project: { _id: 0, date: '$_id', minutes: { $round: ['$minutes', 0] } } },
    { $sort: { date: 1 } },
  ]
  return (await FocusRecord.aggregate(pipeline)) as unknown as HeatPoint[]
}

export interface ReportSummary {
  totalFocusMinutes: number
  completedPomodoros: number
  streakDays: number
  byDay: { date: string; minutes: number }[]
}

/** 周/月报表（week：最近一个自然周一起；month：本月 1 号起） */
export async function report(uid: string, range: 'week' | 'month'): Promise<ReportSummary> {
  const now = new Date()
  let start: Date
  if (range === 'week') {
    const d = new Date(now)
    const day = d.getDay() || 7 // 周一=1 … 周日=7
    d.setDate(d.getDate() - day + 1)
    d.setHours(0, 0, 0, 0)
    start = d
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const records = await FocusRecord.find({
    userId: new mongoose.Types.ObjectId(uid),
    kind: 'focus',
    startedAt: { $gte: start },
  }).select('actualSec completed startedAt')

  const byDayMap = new Map<string, number>()
  const daySet = new Set<string>()
  let totalFocusMinutes = 0
  let completedPomodoros = 0

  for (const r of records) {
    const key = dateKeyOf(r.startedAt, TZ_OFFSET_MINUTES)
    const minutes = r.actualSec / 60
    totalFocusMinutes += minutes
    if (r.completed) completedPomodoros += 1
    daySet.add(key)
    byDayMap.set(key, (byDayMap.get(key) || 0) + minutes)
  }

  const byDay = [...byDayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))

  // 连续天数：从今天（今天无记录则从昨天）往回数
  let streakDays = 0
  const cursor = new Date(now)
  if (!daySet.has(dateKeyOf(cursor, TZ_OFFSET_MINUTES))) cursor.setDate(cursor.getDate() - 1)
  while (daySet.has(dateKeyOf(cursor, TZ_OFFSET_MINUTES))) {
    streakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    totalFocusMinutes: Math.round(totalFocusMinutes),
    completedPomodoros,
    streakDays,
    byDay,
  }
}
