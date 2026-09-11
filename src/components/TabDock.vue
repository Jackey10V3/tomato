<script setup lang="ts">
/**
 * 底部悬浮 Dock（仿系统应用市场的胶囊导航）。
 *
 * 为什么要自己画：原生 tabBar 不能圆角、不能悬浮、不能做玻璃材质，
 * 而这正是平板界面的视觉重心。做法：每个 tab 页挂载时用 hideTabBar
 * 藏掉原生栏，由本组件代替，点击仍走 uni.switchTab（页面缓存行为不变）。
 *
 * 图标不用 static/tab 里的 PNG：那套是给原生 tabBar 的位图，风格互不统一
 * （线条/实心混着来），放大还糊。这里用 CSS 矢量图形：
 * 任意尺寸都清晰、颜色跟主题变量走、三枚一体。
 */
import { computed, onMounted } from 'vue'
import { useResponsive } from '@/composables/useResponsive'

const props = defineProps<{ current: string }>()

const TABS = [
  { path: '/pages/task/index', label: '待办', icon: 'todo' },
  { path: '/pages/stats/index', label: '统计', icon: 'stats' },
  { path: '/pages/mine/index', label: '我的', icon: 'me' },
]

const { isWide } = useResponsive()

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

/** 激活项的图标颜色交给 CSS（.di.on 里改 --ico），这里只负责结构 */
const items = computed(() => TABS)
</script>

<template>
  <view class="dock" :class="{ wide: isWide }">
    <view
      v-for="t in items"
      :key="t.path"
      class="di press"
      :class="{ on: current === t.path }"
      @click="go(t.path)"
    >
      <!-- 图标（CSS 绘制，颜色统一走 --ico） -->
      <view class="ico" :class="'i-' + t.icon">
        <view v-if="t.icon === 'todo'" class="g" />
        <view v-if="t.icon === 'stats'" class="chart">
          <view class="bar b1" />
          <view class="bar b2" />
          <view class="bar b3" />
        </view>
        <template v-if="t.icon === 'me'">
          <view class="head" />
          <view class="body" />
        </template>
      </view>
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
  padding: 10rpx 14rpx;
  border-radius: 999rpx;
  /* 降低不透明度，让底色透出来，避免白色胶囊形成明显"白边" */
  background: var(--p-glass-strong, rgba(255, 255, 255, 0.55));
  border: none;
  box-shadow: 0 14rpx 44rpx rgba(40, 20, 10, 0.16);
  /* 全页只有这一个模糊层（面积小、常驻） */
  backdrop-filter: blur(20rpx) saturate(150%);
  -webkit-backdrop-filter: blur(20rpx) saturate(150%);
  z-index: 90;
}

/* 项：等宽居中，避免"哪个词长哪项就宽"的参差感 */
.di {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  min-width: 150rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  /* 图标/文字的颜色统一从一个变量取，激活时只改这一个变量 */
  --ico: var(--p-sub, #9a8f92);
}
.di.on {
  background: var(--p-soft, rgba(229, 57, 53, 0.12));
  --ico: var(--p-primary, #e53935);
}
.di-label { font-size: 20rpx; color: var(--p-sub, #9a8f92); }
.di.on .di-label { color: var(--p-primary, #e53935); font-weight: 700; }

/* ===== CSS 矢量图标（颜色取 --ico，任意尺寸清晰） ===== */
.ico { position: relative; width: 44rpx; height: 44rpx; }

/* 待办：三行清单（最后一行短，更像"列表"） */
.i-todo .g {
  position: absolute;
  left: 2rpx;
  right: 2rpx;
  top: 8rpx;
  height: 28rpx;
  background-image:
    linear-gradient(var(--ico), var(--ico)),
    linear-gradient(var(--ico), var(--ico)),
    linear-gradient(var(--ico), var(--ico));
  background-size: 100% 5rpx, 100% 5rpx, 62% 5rpx;
  background-position: 0 0, 0 11.5rpx, 0 23rpx;
  background-repeat: no-repeat;
  border-radius: 3rpx;
}

/* 统计：迷你柱状图，一眼认出"统计"含义 */
.i-stats .chart {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 32rpx;
  height: 28rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.i-stats .bar {
  width: 6rpx;
  border-radius: 2rpx;
  background: var(--ico);
}
.i-stats .b1 { height: 14rpx; }
.i-stats .b2 { height: 22rpx; }
.i-stats .b3 { height: 18rpx; }

/* 我的：线稿小人（与 todo/stats 同为描边风格） */
.i-me .head {
  position: absolute;
  left: 50%;
  top: 2rpx;
  width: 14rpx;
  height: 14rpx;
  margin-left: -7rpx;
  border-radius: 50%;
  border: 4rpx solid var(--ico);
  background: transparent;
}
.i-me .body {
  position: absolute;
  left: 50%;
  bottom: 3rpx;
  width: 30rpx;
  height: 25rpx;
  margin-left: -15rpx;
  border: 4rpx solid var(--ico);
  border-top: none;
  border-radius: 50% 50% 0 0;
  background: transparent;
}

/* ===== 宽屏（平板）：整体放大，否则 1280px 屏上只占一成宽，显得小气 ===== */
.dock.wide { padding: 14rpx 20rpx; }
.dock.wide .di { min-width: 230rpx; padding: 14rpx 28rpx; gap: 6rpx; }
.dock.wide .ico { width: 56rpx; height: 56rpx; }
.dock.wide .i-todo .g { top: 11rpx; height: 34rpx; background-size: 100% 6rpx, 100% 6rpx, 62% 6rpx; background-position: 0 0, 0 14rpx, 0 28rpx; }
.dock.wide .i-stats .chart { width: 40rpx; height: 34rpx; }
.dock.wide .i-stats .bar { width: 8rpx; border-radius: 3rpx; }
.dock.wide .i-stats .b1 { height: 18rpx; }
.dock.wide .i-stats .b2 { height: 28rpx; }
.dock.wide .i-stats .b3 { height: 22rpx; }
.dock.wide .i-me .head { width: 18rpx; height: 18rpx; margin-left: -9rpx; top: 3rpx; border-width: 5rpx; }
.dock.wide .i-me .body { width: 38rpx; height: 32rpx; margin-left: -19rpx; bottom: 4rpx; border-width: 5rpx; border-radius: 50% 50% 0 0; }
.dock.wide .di-label { font-size: 24rpx; }
</style>
