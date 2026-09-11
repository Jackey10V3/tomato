<script setup lang="ts">
import { computed } from 'vue'
import { dateKey } from '@/utils/date'

export interface HeatPoint {
  date: string // YYYY-MM-DD
  minutes: number
}

const props = defineProps<{ points: HeatPoint[] }>()

/** GitHub 风格热力色阶 */
const LEVELS = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']

const byDate = computed(() => {
  const m = new Map<string, number>()
  props.points.forEach(p => m.set(p.date, p.minutes))
  return m
})
const maxMin = computed(() => Math.max(1, ...props.points.map(p => p.minutes)))

/** 生成周网格：以最近 365 天内的周为单位，weekday 列对齐 */
const weeks = computed(() => {
  const cells: { date: string; minutes: number; level: number }[] = []
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 363) // 一年窗口
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d)
    const minutes = byDate.value.get(key) || 0
    const level = minutes <= 0 ? 0 : minutes >= maxMin.value ? 4 : Math.ceil((minutes / maxMin.value) * 4)
    cells.push({ date: key, minutes, level: Math.min(4, level) })
  }
  return cells
})

function cellColor(level: number): string {
  return LEVELS[level] || LEVELS[0]
}
</script>

<template>
  <view class="heatmap">
    <view v-for="(c, i) in weeks" :key="i" class="cell" :style="{ background: cellColor(c.level) }" />
    <text class="hint">近一年专注热力图（颜色越深专注越久）</text>
  </view>
</template>

<style lang="scss" scoped>
.heatmap {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx;
  background: #fff;
  border-radius: $tomato-radius;
  padding: 24rpx;
}
.cell {
  width: 20rpx;
  height: 20rpx;
  border-radius: 4rpx;
}
.hint {
  width: 100%;
  font-size: 20rpx;
  color: $tomato-info;
  margin-top: 12rpx;
}
</style>
