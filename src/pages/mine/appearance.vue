<script setup lang="ts">
/** 外观与音效（全部真实生效）：主题皮肤 / 深色模式 / 背景海报 / 提示音 / 音量 / 振动 */
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { themeStyle, themeOptions, posterBg, posterOptions } from '@/utils/theme'
import { SOUNDS, type SoundKey, type ThemeKey, type PosterKey } from '@/types/app'
import { playEffect, testAllSounds } from '@/utils/audioEngine'
import { platform } from '@/platform'

const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
/** 当前环境是否支持振动（H5 的 iOS Safari 不支持，给用户一个明确说明而不是"点了没反应"） */
const hapticOk = platform.haptic.isSupported()

function testVibrate() {
  platform.haptic.heavy()
  if (!hapticOk) {
    uni.showModal({
      title: '当前环境不支持振动',
      content: '浏览器（尤其 iOS Safari）没有振动能力。装成 App 后即可正常振动；鸿蒙端还需要在鸿蒙工程里声明 ohos.permission.VIBRATE。',
      showCancel: false,
    })
    return
  }
  uni.showToast({ title: '已触发振动', icon: 'none' })
}
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))

function pickTheme(key: ThemeKey) {
  settings.setTheme(key)
}
function pickSound(slot: 'start' | 'end' | 'giveup' | 'warn', key: SoundKey) {
  settings.setSounds({ [slot]: key })
}
function preview(key: SoundKey) {
  playEffect(key, 'start')
}
function pickPoster(key: PosterKey) {
  settings.setPoster(key)
}
function onVolume(e: { detail: { value: number } }) {
  settings.setVolume(e.detail.value / 100)
}

const SOUND_SLOTS: { key: 'start' | 'end' | 'giveup' | 'warn'; label: string; emoji: string }[] = [
  { key: 'start', label: '开始计时', emoji: '▶️' },
  { key: 'end', label: '完成提示', emoji: '🏁' },
  { key: 'giveup', label: '放弃提示', emoji: '🚫' },
  { key: 'warn', label: '离席警告', emoji: '⚠️' },
]

onShow(() => {
  settings.applySideEffects()
})
</script>

<template>
  <view class="screen" :style="[style, { background: posterBg(settings.s.poster) }]">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">外观与音效</text>
    </view>

    <scroll-view scroll-y class="body">
      <!-- 主题 -->
      <view class="card">
        <text class="m-title">🎨 主题皮肤</text>
        <view class="themes">
          <view v-for="t in themeOptions" :key="t.key" class="theme" @click="pickTheme(t.key)">
            <view class="swatch" :class="{ on: settings.s.theme === t.key }" :style="{ background: `linear-gradient(135deg, ${t.gradientLight}, ${t.gradientDeep})` }">
              <text v-if="settings.s.theme === t.key">✓</text>
            </view>
            <text class="name">{{ t.name }}</text>
          </view>
        </view>
      </view>

      <!-- 深色模式 + 振动 -->
      <view class="card">
        <view class="row">
          <view class="lbl">
            <text class="lbl-t">🌙 深色模式</text>
            <text class="lbl-s">全局暗色配色，夜间更护眼</text>
          </view>
          <view class="sw" :class="{ on: settings.s.dark }" @click="settings.setDark(!settings.s.dark)" />
        </view>
        <view class="row">
          <view class="lbl">
            <text class="lbl-t">📳 振动反馈</text>
            <text class="lbl-s">开始 / 完成 / 警告时轻振动{{ hapticOk ? '' : '（当前环境不支持振动）' }}</text>
          </view>
          <view class="sw" :class="{ on: settings.s.vibrate }" @click="settings.update({ vibrate: !settings.s.vibrate })" />
        </view>
        <view class="test-all" @click="testVibrate">📳 测试振动</view>
      </view>

      <!-- 背景海报 -->
      <view class="card">
        <text class="m-title">🖼️ 背景海报（待办 / 统计背景）</text>
        <view class="posters">
          <view v-for="p in posterOptions" :key="p.key" class="poster" :class="{ on: settings.s.poster === p.key }" @click="pickPoster(p.key)">
            <view class="pbg" :style="{ background: posterBg(p.key) }">
              <text v-if="settings.s.poster === p.key" class="pok">✓</text>
            </view>
            <text class="pname">{{ p.label }}</text>
          </view>
        </view>
      </view>

      <!-- 音量 -->
      <view class="card">
        <text class="m-title">🔊 音量</text>
        <view class="vol-row">
          <text class="vol-ico">🔈</text>
          <slider class="slider" :value="Math.round(settings.s.volume * 100)" min="0" max="100" block-size="20" :activeColor="settings.themeDef.primary" backgroundColor="#f0dfe3" @change="onVolume" />
          <text class="vol-val">{{ Math.round(settings.s.volume * 100) }}%</text>
        </view>
        <text class="desc">影响提示音与白噪音的整体音量</text>
      </view>

      <!-- 提示音 -->
      <view class="card">
        <text class="m-title">🔔 提示音（程序合成，可试听）</text>
        <view v-for="slot in SOUND_SLOTS" :key="slot.key" class="sound-row">
          <text class="s-emoji">{{ slot.emoji }}</text>
          <view class="s-main">
            <text class="s-label">{{ slot.label }}</text>
            <view class="s-chips">
              <view v-for="sd in SOUNDS" :key="sd.key" class="s-chip" :class="{ on: settings.s.sounds[slot.key] === sd.key }" @click="pickSound(slot.key, sd.key)">
                {{ sd.label }}
              </view>
            </view>
          </view>
          <text class="s-preview" @click="preview(settings.s.sounds[slot.key])">试听</text>
        </view>
        <view class="test-all" @click="testAllSounds">🔊 一键测试全部提示音</view>
      </view>

      <view class="card note">
        <text>数据全部本地保存。锁屏 / 后台原生保活、上传自定义音效等能力将在原生插件阶段开放（设计方案 4.4 / 4.5）。</text>
      </view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.body { height: calc(100vh - 130rpx); }
.card { background: var(--p-card, #fff); border-radius: 26rpx; margin: 18rpx 24rpx; padding: 26rpx; box-shadow: 0 8rpx 22rpx rgba(240, 100, 130, 0.07); }
.m-title { font-size: 28rpx; font-weight: 800; color: var(--p-text, #333); }
.themes { display: flex; flex-wrap: wrap; gap: 22rpx; margin-top: 22rpx; }
.theme { display: flex; flex-direction: column; align-items: center; width: calc(25% - 17rpx); }
.swatch {
  width: 96rpx; height: 96rpx; border-radius: 26rpx;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 40rpx; font-weight: 900;
  border: 4rpx solid transparent;
  &.on { border-color: var(--p-primary, #e53935); }
}
.name { font-size: 22rpx; margin-top: 8rpx; color: var(--p-sub, #999); }
.row { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 0; border-bottom: 2rpx solid #f7f4f1; &:last-child { border-bottom: none; } }
.lbl { flex: 1; margin-right: 16rpx; }
.lbl-t { font-size: 28rpx; }
.lbl-s { display: block; font-size: 22rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
.sw {
  width: 92rpx; height: 52rpx; border-radius: 999rpx; background: #d9d2cc; position: relative; flex-shrink: 0; transition: background 0.2s;
  &::after { content: ''; position: absolute; top: 6rpx; left: 6rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #fff; transition: transform 0.2s; }
  &.on { background: var(--p-primary, #e53935); &::after { transform: translateX(40rpx); } }
}
.posters { display: flex; flex-wrap: wrap; gap: 18rpx; margin-top: 20rpx; }
.poster { width: calc(20% - 15rpx); display: flex; flex-direction: column; align-items: center; }
.pbg {
  width: 100%; height: 84rpx; border-radius: 18rpx;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 30rpx; font-weight: 900;
  border: 4rpx solid transparent;
  &.on, .poster.on & { border-color: var(--p-primary, #e53935); }
}
.pok { color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.3); }
.pname { font-size: 22rpx; margin-top: 6rpx; color: var(--p-sub, #999); }
.vol-row { display: flex; align-items: center; gap: 16rpx; margin-top: 18rpx; }
.vol-ico { font-size: 30rpx; }
.slider { flex: 1; }
.vol-val { font-size: 24rpx; color: var(--p-primary, #e53935); font-weight: 700; width: 80rpx; text-align: right; }
.desc { display: block; margin-top: 10rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.sound-row { display: flex; align-items: flex-start; gap: 16rpx; margin-top: 24rpx; }
.s-emoji { font-size: 34rpx; }
.s-main { flex: 1; }
.s-label { font-size: 26rpx; font-weight: 600; }
.s-chips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; }
.s-chip {
  font-size: 22rpx; background: var(--p-soft, #f2efec); border-radius: 999rpx; padding: 6rpx 18rpx; color: var(--p-sub, #777);
  &.on { background: var(--p-primary, #e53935); color: #fff; }
}
.s-preview { color: var(--p-primary, #e53935); font-size: 24rpx; margin-top: 8rpx; }
.test-all {
  margin-top: 26rpx; text-align: center;
  background: var(--p-soft, #fdecef); color: var(--p-primary, #e53935);
  border-radius: 999rpx; padding: 18rpx; font-size: 26rpx; font-weight: 700;
}
.note { font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.7; }
.bottom-space { height: 80rpx; }
</style>
