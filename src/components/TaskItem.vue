<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types/task'
import PriorityBadge from './PriorityBadge.vue'

const props = defineProps<{ task: Task; compact?: boolean }>()
const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'remove'): void
  (e: 'edit'): void
  (e: 'focus'): void
}>()

const doneRate = computed(() => {
  const t = props.task
  if (t.subtasks.length === 0) return null
  const d = t.subtasks.filter(s => s.done).length
  return Math.round((d / t.subtasks.length) * 100)
})
const repeatLabel = computed(() =>
  props.task.repeat === 'daily' ? '每天' : props.task.repeat === 'weekly' ? '每周' : '',
)
</script>

<template>
  <view class="item" @click="emit('edit')">
    <view class="check" :class="{ done: task.completed }" @click.stop="emit('toggle')">
      {{ task.completed ? '✓' : '' }}
    </view>

    <view class="main">
      <view class="title-row">
        <text class="title" :class="{ done: task.completed }">{{ task.title }}</text>
        <text v-if="repeatLabel" class="rep">↻{{ repeatLabel }}</text>
      </view>

      <view class="meta">
        <template v-if="task.tags.length">
          <text v-for="tag in task.tags.slice(0, 3)" :key="tag" class="chip">#{{ tag }}</text>
        </template>
        <text v-if="task.dueDate" class="due">📅 {{ task.dueDate.slice(5) }}</text>
        <text v-if="doneRate !== null" class="sub-tasks">☑ {{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</text>
        <PriorityBadge v-if="!compact" :priority="task.priority" />
      </view>
    </view>

    <view class="right">
      <view class="pomo" :class="{ full: task.estimate > 0 && task.done >= task.estimate }">
        🍅 {{ task.done }}/{{ task.estimate || '∞' }}
      </view>
      <view class="ops">
        <text class="op focus" @click.stop="emit('focus')">▶</text>
        <text class="op del" @click.stop="emit('remove')">✕</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: var(--p-card, #fff);
  border-radius: var(--p-radius, 24rpx);
  padding: 24rpx;
  margin: 14rpx 0;
  box-shadow: 0 4rpx 16rpx rgba(40, 20, 10, 0.04);
}
.check {
  width: 44rpx;
  height: 44rpx;
  flex-shrink: 0;
  border-radius: 50%;
  border: 3rpx solid #d8d2cc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  background: transparent;
  &.done {
    background: var(--p-primary, #e53935);
    border-color: var(--p-primary, #e53935);
  }
}
.main { flex: 1; min-width: 0; }
.title-row { display: flex; align-items: center; gap: 10rpx; }
.title {
  font-size: 30rpx;
  color: var(--p-text, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &.done { color: var(--p-sub, #bbb); text-decoration: line-through; }
}
.rep { font-size: 20rpx; color: var(--p-primary, #e53935); flex-shrink: 0; }
.meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
  .chip { font-size: 20rpx; padding: 2rpx 12rpx; }
  .due { font-size: 20rpx; color: var(--p-sub, #999); }
  .sub-tasks { font-size: 20rpx; color: var(--p-sub, #999); }
}
.right { display: flex; flex-direction: column; align-items: flex-end; gap: 10rpx; flex-shrink: 0; }
.pomo {
  font-size: 22rpx;
  color: var(--p-primary, #e53935);
  font-weight: 600;
  &.full { color: var(--p-sub, #999); }
}
.ops { display: flex; gap: 18rpx; }
.op { font-size: 30rpx; padding: 6rpx; }
.op.focus { color: var(--p-primary, #e53935); }
.op.del { color: #c9c2bc; }
</style>
