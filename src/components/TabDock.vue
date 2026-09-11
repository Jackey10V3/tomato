<script setup lang="ts">
/**
 * 底部悬浮 Dock（仿系统应用市场的胶囊导航）。
 *
 * 为什么要自己画：原生 tabBar 不能圆角、不能悬浮、不能做玻璃材质，
 * 而这正是平板界面的视觉重心（用户点名要应用市场那种）。
 * 做法：每个 tab 页挂载时用 hideTabBar 藏掉原生栏，由本组件代替，
 * 点击仍走 uni.switchTab（页面栈/缓存行为与原生完全一致）。
 */
import { onMounted } from 'vue'

const props = defineProps<{ current: string }>()

const TABS = [
  { path: '/pages/task/index', label: '待办', off: '/static/tab/todo.png', on: '/static/tab/todo-on.png' },
  { path: '/pages/stats/index', label: '统计', off: '/static/tab/charts.png', on: '/static/tab/charts-on.png' },
  { path: '/pages/mine/index', label: '我的', off: '/static/tab/me.png', on: '/static/tab/me-on.png' },
]

onMounted(() => {
  // 每个 tab 页挂载时都调一次：hideTabBar 在 onLaunch 时机偶发不生效
  try {
    uni.hideTabBar({ animation: false })
  } catch {
    /* 平台不支持时保留原生栏，Dock 会与之重叠但不影响功能 */
  }
})

function go(path: string) {
  if (path === props.current) return
  uni.switchTab({ url: path })
}
</script>

<template>
  <view class="dock">
    <view
      v-for="t in TABS"
      :key="t.path"
      class="di press"
      :class="{ on: current === t.path }"
      @click="go(t.path)"
    >
      <image class="di-ico" :src="current === t.path ? t.on : t.off" mode="aspectFit" />
      <text class="di-label">{{ t.label }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(16rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: var(--p-glass-strong, rgba(255, 255, 255, 0.9));
  border: 1rpx solid var(--p-glass-line, rgba(255, 255, 255, 0.75));
  box-shadow:
    0 14rpx 44rpx rgba(40, 20, 10, 0.18),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.6);
  /* 全页只有这一个模糊层（面积小、常驻），玻璃 Dock 的点睛之笔 */
  backdrop-filter: blur(20rpx) saturate(150%);
  -webkit-backdrop-filter: blur(20rpx) saturate(150%);
  z-index: 90;
}
.di {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  padding: 10rpx 34rpx;
  border-radius: 999rpx;
}
.di-ico { width: 46rpx; height: 46rpx; }
.di-label { font-size: 20rpx; color: var(--p-sub, #999); }
.di.on { background: var(--p-soft, rgba(229, 57, 53, 0.12)); }
.di.on .di-label { color: var(--p-primary, #e53935); font-weight: 700; }
</style>
