/** 统计接口 */

import { http } from './http'

export interface HeatmapPoint {
  date: string // YYYY-MM-DD
  minutes: number
}

export interface ReportSummary {
  totalFocusMinutes: number
  completedPomodoros: number
  streakDays: number
  /** 按天聚合，用于图表 */
  byDay: { date: string; minutes: number }[]
  byTag?: { tag: string; minutes: number }[]
}

export const statsApi = {
  /** 专注热力图数据（UTC 起止 ms） */
  heatmap(from: number, to: number): Promise<HeatmapPoint[]> {
    return http.get<HeatmapPoint[]>(`/stats/heatmap?from=${from}&to=${to}`)
  },
  /** 周 / 月报表 */
  report(range: 'week' | 'month'): Promise<ReportSummary> {
    return http.get<ReportSummary>(`/stats/report?range=${range}`)
  },
}
