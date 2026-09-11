<script setup lang="ts">
/** 白噪音混音面板（多选叠加；雷雨为独占音源）。用于浅色待机态，跟随主题变量。 */
import { useWhiteNoise } from '@/composables/useWhiteNoise'

const noise = useWhiteNoise()
</script>

<template>
  <view class="noise">
    <view class="head">
      <text class="t">白噪音</text>
      <text v-if="noise.state.active.length" class="active-n">播放中 {{ noise.state.active.length }} 轨</text>
    </view>
    <text v-if="!noise.state.supported" class="warn">当前环境不支持程序合成音频（请用 H5 或 App 体验）</text>

    <view class="grid">
      <view v-for="opt in noise.options" :key="opt.key" class="cell" :class="{ on: noise.isOn(opt.key) }" @click="noise.toggle(opt.key)">
        <text class="emoji">{{ opt.emoji }}</text>
        <text class="name">{{ opt.label }}</text>
        <text v-if="noise.isOn(opt.key)" class="eq">◉</text>
      </view>
    </view>

    <view v-if="noise.state.active.length" class="foot">
      <text class="mix-tip">可多轨叠加（如 雨声＋钢琴）</text>
      <text class="stop" @click="noise.stopAll">全部停止</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.noise { margin-top: 6rpx; }
.head { display: flex; align-items: center; justify-content: space-between; margin: 0 4rpx 14rpx; }
.t { font-size: 26rpx; font-weight: 600; color: var(--p-text, #333); }
.active-n { font-size: 22rpx; color: var(--p-primary, #e53935); }
.warn { display: block; font-size: 20rpx; color: #f9a825; margin-bottom: 8rpx; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14rpx; }
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18rpx 0 12rpx;
  border-radius: 20rpx;
  background: var(--p-card, #fff);
  border: 2rpx solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
  .emoji { font-size: 40rpx; }
  .name { font-size: 20rpx; color: var(--p-sub, #999); margin-top: 6rpx; }
  .eq {
    position: absolute;
    top: 8rpx;
    right: 14rpx;
    font-size: 18rpx;
    color: var(--p-primary, #e53935);
  }
  &.on {
    border-color: var(--p-primary, #e53935);
    background: rgba(255, 238, 236, 0.8); /* 兼容旧 webview 的 fallback */
    background: color-mix(in srgb, var(--p-primary, #e53935) 8%, #fff);
    .name { color: var(--p-primary, #e53935); font-weight: 700; }
  }
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14rpx;
  padding: 0 6rpx;
  .mix-tip { font-size: 20rpx; color: var(--p-sub, #999); }
  .stop { font-size: 22rpx; color: var(--p-primary, #e53935); }
}
</style>
