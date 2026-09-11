<script setup lang="ts">
import { computed } from 'vue'
import { formatMs } from '@/utils/date'
import { PHASE_LABEL } from '@/types/pomodoro'

const props = defineProps<{
  progress: number
  remainMs: number
  phase: string
  round?: number
  roundsPerCycle?: number
}>()

const timeText = computed(() => formatMs(props.remainMs))
const percent = computed(() => Math.round(props.progress * 100))
const phaseEmoji = computed(() =>
  props.phase === 'focus' ? '🍅' : props.phase === 'longBreak' ? '☕' : '🌿',
)
const dots = computed(() => {
  const cycle = props.roundsPerCycle || 4
  const pos = ((props.round || 0) - 1 + cycle) % cycle
  return Array.from({ length: cycle }, (_, i) => i === pos)
})
</script>

<template>
  <view class="timer">
    <view class="phase">
      <text class="emoji">{{ phaseEmoji }}</text>
      <text class="phase-text">{{ PHASE_LABEL[phase as keyof typeof PHASE_LABEL] || phase }}</text>
    </view>

    <view class="ring">
      <view class="time">{{ timeText }}</view>
      <view class="round-dots">
        <text v-for="(on, i) in dots" :key="i" class="dot" :class="{ on }">●</text>
      </view>
    </view>

    <view class="bar-track">
      <view class="bar-fill" :style="{ width: percent + '%' }" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.timer {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.phase {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
  .emoji { font-size: 44rpx; }
  .phase-text { font-size: 32rpx; color: $tomato-text-main; font-weight: 600; }
}
.ring {
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, #ffe9e7);
  border: 14rpx solid $tomato-primary;
  box-shadow: 0 12rpx 40rpx rgba(229, 77, 66, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  .time {
    font-size: 100rpx;
    font-weight: 700;
    color: $tomato-text-main;
    font-variant-numeric: tabular-nums;
  }
  .round-dots {
    margin-top: 10rpx;
    .dot { color: #ddd; font-size: 20rpx; margin: 0 6rpx; }
    .dot.on { color: $tomato-primary; }
  }
}
.bar-track {
  margin-top: 40rpx;
  width: 560rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: #eee;
  overflow: hidden;
  .bar-fill {
    height: 100%;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #f6a5a0, $tomato-primary);
    transition: width 0.3s linear;
  }
}
</style>
