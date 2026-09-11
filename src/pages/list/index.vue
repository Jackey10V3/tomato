<script setup lang="ts">
/** 待办集：清单分组列表（今天/收集箱/未来/自定义），点开可看到组内任务并直达钟 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useTaskStore } from '@/store/modules/task'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { themeStyle, posterBg } from '@/utils/theme'
import { cardGradient } from '@/utils/constant'
import type { Task } from '@/types/task'

const store = useTaskStore()
const settings = useSettingsStore()
const { statusBarH } = useChrome()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))

const groups = computed(() =>
  store.lists.map(l => ({
    ...l,
    tasks: store.tasks.filter(t => !t.deleted && !t.completed && t.listId === l.id),
  })),
)
const openId = ref<string>('')

function toggle(id: string) {
  openId.value = openId.value === id ? '' : id
}
function openTimer(t: Task) {
  uni.navigateTo({ url: `/pages/timer/detail?id=${t._id}` })
}

onShow(() => {
  if (!store.loaded) store.loadLocal()
  settings.applySideEffects()
})
</script>

<template>
  <view class="screen" :style="[style, { background: poster }]">
    <view class="topbar" :style="{ paddingTop: statusBarH + 'px' }">
      <text class="tb-title">待办集</text>
      <text class="tb-sub">清单 · {{ groups.length }}</text>
    </view>

    <scroll-view scroll-y class="body">
      <view v-for="(g, gi) in groups" :key="g.id" class="group fade-row" :style="{ animationDelay: gi * 50 + 'ms' }">
        <view class="g-head" @click="toggle(g.id)">
          <text class="g-ico">{{ g.icon }}</text>
          <text class="g-name">{{ g.name }}</text>
          <text class="g-count">{{ g.tasks.length }}</text>
          <text class="arrow" :class="{ open: openId === g.id }">›</text>
        </view>
        <view v-if="openId === g.id" class="g-body">
          <view v-for="t in g.tasks" :key="t._id" class="mini" :style="{ background: cardGradient(gi) }" @click="openTimer(t)">
            <text class="m-title">{{ t.title }}</text>
            <text class="m-sub">{{ t.mode === 'countdown' ? `${t.minutes} 分钟` : '正向计时' }}</text>
            <text class="m-go">开始 ›</text>
          </view>
          <view v-if="!g.tasks.length" class="g-empty">该清单还没有待办</view>
        </view>
      </view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.screen { min-height: 100vh; background: var(--p-bg, #fbf3f3); color: #333; display: flex; flex-direction: column; }
.topbar {
  background: linear-gradient(180deg, #f7c1cf 0%, var(--p-bg, #fbf3f3) 100%);
  padding-left: 30rpx; padding-right: 30rpx; padding-bottom: 18rpx;
  display: flex; align-items: baseline; gap: 16rpx;
  .tb-title { font-size: 40rpx; font-weight: 800; color: #7a2b3c; }
  .tb-sub { font-size: 22rpx; color: #c04a63; }
}
.body { height: calc(100vh - 180rpx); padding: 6rpx 26rpx 0; }
.group { background: #fff; border-radius: 26rpx; margin-bottom: 20rpx; overflow: hidden; box-shadow: 0 6rpx 20rpx rgba(120, 110, 130, 0.08); }
.g-head { display: flex; align-items: center; gap: 14rpx; padding: 26rpx 24rpx; }
.g-ico { font-size: 40rpx; }
.g-name { flex: 1; font-size: 30rpx; font-weight: 700; }
.g-count { font-size: 22rpx; color: var(--p-primary, #e53935); font-weight: 700; }
.arrow { font-size: 40rpx; color: #d8d2cc; transition: transform 0.2s; &.open { transform: rotate(90deg); } }
.g-body { padding: 0 20rpx 20rpx; }
.mini {
  display: flex; align-items: center; gap: 14rpx;
  border-radius: 20rpx; padding: 22rpx 22rpx; margin-bottom: 14rpx; color: #fff;
  .m-title { flex: 1; font-size: 28rpx; font-weight: 700; }
  .m-sub { font-size: 20rpx; opacity: 0.92; }
  .m-go { font-size: 24rpx; background: rgba(255,255,255,0.9); color: #5a4a52; border-radius: 999rpx; padding: 6rpx 20rpx; }
}
.g-empty { font-size: 22rpx; color: #b9a2a8; padding: 6rpx 8rpx 16rpx; }
.bottom-space { height: 120rpx; }
</style>
