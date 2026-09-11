import { defineStore } from 'pinia'
import { statsApi } from '@/api/stats'
import type { HeatmapPoint, ReportSummary } from '@/api/stats'
import { dateKey } from '@/utils/date'

/** 本地生成近 N 天占位数据（后端未就绪 / 未登录时可预览 UI） */
function placeholderHeatmap(days: number): HeatmapPoint[] {
  const list: HeatmapPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    list.push({
      date: dateKey(d),
      minutes: Math.random() > 0.45 ? Math.round(Math.random() * 150) : 0,
    })
  }
  return list
}

export const useStatsStore = defineStore('stats', {
  state: () => ({
    heatmap: [] as HeatmapPoint[],
    report: null as ReportSummary | null,
    loading: false,
  }),

  actions: {
    async load(days = 60) {
      this.loading = true
      try {
        const to = Date.now()
        const from = to - days * 24 * 3600 * 1000
        this.heatmap = await statsApi.heatmap(from, to)
        this.report = await statsApi.report('week')
      } catch (e) {
        // 未登录 / 后端未启动：给占位数据便于预览页面
        console.warn('[stats] load fallback to placeholder', e)
        this.heatmap = placeholderHeatmap(days)
        this.report = {
          totalFocusMinutes: this.heatmap.reduce((a, b) => a + b.minutes, 0),
          completedPomodoros: 0,
          streakDays: 0,
          byDay: this.heatmap.filter(h => h.minutes > 0),
        }
      } finally {
        this.loading = false
      }
    },
  },
})
