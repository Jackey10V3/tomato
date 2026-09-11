<script setup lang="ts">
import { computed } from 'vue'
import type { RoomMember } from '@/types/room'

const props = defineProps<{ members: RoomMember[] }>()

const stateEmoji: Record<RoomMember['state'], string> = { focus: '🍅', break: '☕', idle: '💤' }
const stateText: Record<RoomMember['state'], string> = { focus: '专注中', break: '休息中', idle: '空闲' }

const counts = computed(() => {
  const c = { focus: 0, break: 0, idle: 0 }
  props.members.forEach(m => c[m.state]++)
  return c
})
const initials = (name: string) => (name || '?').slice(0, 1).toUpperCase()
</script>

<template>
  <view class="bar">
    <view class="stats">
      <text class="online">🟢 {{ members.length }} 人在线</text>
      <text v-for="s in (['focus', 'break', 'idle'] as const)" :key="s" class="stat">
        {{ stateEmoji[s] }} {{ stateText[s] }} {{ counts[s] }}
      </text>
    </view>

    <scroll-view scroll-x class="avatars">
      <view v-for="m in members" :key="m.userId" class="avatar-wrap">
        <view class="avatar" :class="m.state">{{ initials(m.nickname) }}</view>
        <text class="avatar-name">{{ m.nickname }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.bar { background: #fff; border-radius: $tomato-radius; padding: 20rpx; }
.stats {
  display: flex;
  gap: 20rpx;
  flex-wrap: wrap;
  font-size: 22rpx;
  color: $tomato-info;
  .online { color: $tomato-success; font-weight: 600; }
}
.avatars { margin-top: 16rpx; white-space: nowrap; }
.avatar-wrap { display: inline-flex; flex-direction: column; align-items: center; margin-right: 18rpx; }
.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #ffe9e7;
  color: $tomato-primary;
  text-align: center;
  line-height: 72rpx;
  font-size: 30rpx;
  font-weight: 600;
  &.focus { box-shadow: 0 0 0 4rpx $tomato-primary; }
  &.break { box-shadow: 0 0 0 4rpx #f0c040; }
  &.idle { box-shadow: 0 0 0 4rpx #c0c4cc; }
}
.avatar-name { max-width: 100rpx; overflow: hidden; text-overflow: ellipsis; font-size: 18rpx; color: $tomato-info; }
</style>
