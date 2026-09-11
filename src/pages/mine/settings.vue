<script setup lang="ts">
/** 计时核心设置：时长 / 轮次 / 自动衔接 / 默认模式 / 午夜归属 */
import { computed } from 'vue'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { themeStyle } from '@/utils/theme'

const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))
const cfg = computed(() => settings.s.timer)

function inc(key: 'focusMin' | 'shortMin' | 'longMin' | 'roundsPerCycle', delta: number) {
  const min = key === 'roundsPerCycle' ? 2 : 1
  const max = key === 'roundsPerCycle' ? 8 : 120
  const next = Math.min(max, Math.max(min, cfg.value[key] + delta))
  settings.updateTimer({ [key]: next })
}
</script>

<template>
  <view class="screen" :style="style">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">计时设置</text>
    </view>

    <scroll-view scroll-y class="body">
      <view class="card">
        <text class="sec-h">番茄节奏</text>
        <view class="row">
          <text>🍅 专注时长（分钟）</text>
          <view class="stepper"><view class="step" @click="inc('focusMin', -1)">−</view><text class="num">{{ cfg.focusMin }}</text><view class="step" @click="inc('focusMin', 1)">＋</view></view>
        </view>
        <view class="row">
          <text>🌿 短休息（分钟）</text>
          <view class="stepper"><view class="step" @click="inc('shortMin', -1)">−</view><text class="num">{{ cfg.shortMin }}</text><view class="step" @click="inc('shortMin', 1)">＋</view></view>
        </view>
        <view class="row">
          <text>☕ 长休息（分钟）</text>
          <view class="stepper"><view class="step" @click="inc('longMin', -1)">−</view><text class="num">{{ cfg.longMin }}</text><view class="step" @click="inc('longMin', 1)">＋</view></view>
        </view>
        <view class="row">
          <text>🔁 几个番茄后进入长休息</text>
          <view class="stepper"><view class="step" @click="inc('roundsPerCycle', -1)">−</view><text class="num">{{ cfg.roundsPerCycle }}</text><view class="step" @click="inc('roundsPerCycle', 1)">＋</view></view>
        </view>
      </view>

      <view class="card">
        <text class="sec-h">默认模式</text>
        <view class="mode-cards">
          <view class="mode-card" :class="{ on: settings.s.defaultMode === 'countdown' }" @click="settings.update({ defaultMode: 'countdown' })">
            <text class="m-icon">⏳</text>
            <text class="m-name">倒计时</text>
            <text class="m-desc">经典番茄钟，时间到自动衔接休息</text>
          </view>
          <view class="mode-card" :class="{ on: settings.s.defaultMode === 'countup' }" @click="settings.update({ defaultMode: 'countup' })">
            <text class="m-icon">⏱️</text>
            <text class="m-name">正向计时</text>
            <text class="m-desc">秒表式自由计时，适合阅读 / 背单词</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="row">
          <view class="lbl">
            <text class="lbl-t">⏭️ 自动开始下一阶段</text>
            <text class="lbl-s">专注结束后直接进入休息（休息结束回待机）</text>
          </view>
          <view class="sw" :class="{ on: cfg.autoStartNext }" @click="settings.updateTimer({ autoStartNext: !cfg.autoStartNext })" />
        </view>
        <view class="row">
          <view class="lbl">
            <text class="lbl-t">🌙 午夜模式</text>
            <text class="lbl-s">凌晨 4 点前开始的计时归属前一天（记录更整齐）</text>
          </view>
          <view class="sw" :class="{ on: settings.s.midnightAttach }" @click="settings.update({ midnightAttach: !settings.s.midnightAttach })" />
        </view>
      </view>

      <view class="card">
        <view class="row">
          <view class="lbl">
            <text class="lbl-t">📳 振动反馈</text>
            <text class="lbl-s">开始 / 完成 / 警告时轻振动</text>
          </view>
          <view class="sw" :class="{ on: settings.s.vibrate }" @click="settings.update({ vibrate: !settings.s.vibrate })" />
        </view>
      </view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.body { height: calc(100vh - 110rpx); }
.sec-h { display: block; font-size: 24rpx; color: var(--p-sub, #999); margin-bottom: 6rpx; }
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 0;
  border-bottom: 2rpx solid #f7f4f1;
  &:last-child { border-bottom: none; }
  font-size: 28rpx;
  .lbl { flex: 1; margin-right: 20rpx; }
  .lbl-t { font-size: 28rpx; }
  .lbl-s { display: block; font-size: 20rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
}
.stepper { display: flex; align-items: center; gap: 20rpx; }
.step { width: 56rpx; height: 56rpx; border-radius: 50%; background: var(--p-soft, #f2efec); display: flex; align-items: center; justify-content: center; font-size: 32rpx; }
.num { min-width: 52rpx; text-align: center; font-weight: 700; font-size: 30rpx; }
.sw {
  width: 92rpx; height: 52rpx; border-radius: 999rpx; background: var(--p-border, #d9d2cc); position: relative; flex-shrink: 0; transition: background 0.2s;
  &::after { content: ''; position: absolute; top: 6rpx; left: 6rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #fff; transition: transform 0.2s; }
  &.on { background: var(--p-primary, #e53935); &::after { transform: translateX(40rpx); } }
}
.mode-cards { display: flex; gap: 16rpx; margin-top: 14rpx; }
.mode-card {
  flex: 1;
  border-radius: 22rpx;
  border: 3rpx solid #f0ece8;
  padding: 22rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  &.on { border-color: var(--p-primary, #e53935); background: var(--p-soft, #fff6f5); }
  .m-icon { font-size: 44rpx; }
  .m-name { font-size: 28rpx; font-weight: 700; margin-top: 8rpx; }
  .m-desc { font-size: 20rpx; color: var(--p-sub, #999); margin-top: 4rpx; line-height: 1.5; }
}
.bottom-space { height: 80rpx; }
</style>
