<script setup lang="ts">
import { PRIORITY_META } from '@/utils/constant'
import type { Priority } from '@/types/task'

defineProps<{ priority: Priority }>()
</script>

<template>
  <text v-if="priority" class="badge" :style="{ color: PRIORITY_META[priority].color }">
    {{ PRIORITY_META[priority].label }}
  </text>
</template>

<style lang="scss" scoped>
.badge {
  font-size: 20rpx;
  border: 1rpx solid currentColor;
  border-radius: 8rpx;
  padding: 0 10rpx;
  line-height: 1.6;
}
</style>
