<script setup lang="ts">
/** 成就墙：等级 / 经验条 / 称号 / 徽章进度（游戏化成就感） */
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFocusStore } from '@/store/modules/focus'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useEnterAnim } from '@/composables/useEnterAnim'
import { themeStyle, posterBg } from '@/utils/theme'
import { TIER_META } from '@/types/focus'
import { formatDuration } from '@/utils/date'
import { useCountUp } from '@/composables/useCountUp'

const store = useFocusStore()
const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const { animKey } = useEnterAnim()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))
const level = computed(() => store.levelInfo)
const summary = computed(() => store.summary)
const badges = computed(() => store.achievements)
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))

/** 顶部三个数字滚动到位（与统计页同一套动效） */
const pomoView = useCountUp(() => summary.value.totalPomodoros)
const minView = useCountUp(() => summary.value.totalFocusMinutes)
const streakView = useCountUp(() => summary.value.streakDays)
function shown(v: number): number {
  return Math.round(v)
}

/** 已解锁徽章展示解锁日期（MM-DD），让"什么时候拿到的"有据可查 */
function unlockLabel(b: { earned: boolean; unlockedAt: number }): string {
  if (!b.earned) return ''
  if (!b.unlockedAt) return '✨ 已解锁'
  const d = new Date(b.unlockedAt)
  const p = (n: number) => String(n).padStart(2, '0')
  return `✨ ${p(d.getMonth() + 1)}-${p(d.getDate())} 解锁`
}

function goBackSafe() {
  goBack()
}
onShow(() => {
  settings.applySideEffects()
})
</script>

<template>
  <view class="screen" :style="[style, { background: poster }]">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBackSafe">←</text>
      <text class="t-title">成就</text>
      <view class="t-right"><text class="cnt">{{ store.earnedCount }}/{{ badges.length }}</text></view>
    </view>

    <scroll-view scroll-y class="body">
      <view :key="animKey">
        <!-- 等级卡 -->
        <view class="lv-card fade-row">
          <view class="lv-left">
            <view class="lv-badge">
              <text class="lv-num">Lv.{{ level.level }}</text>
            </view>
            <view class="lv-text">
              <text class="lv-title">{{ level.title }}</text>
              <text class="lv-xp">经验 {{ level.xp }} / {{ level.nextXp }}</text>
            </view>
          </view>
          <view class="lv-bar"><view class="lv-fill" :style="{ width: Math.round(level.progress * 100) + '%' }" /></view>
          <text class="lv-hint">再获得 {{ level.nextXp - level.xp }} 经验即可升级</text>
        </view>

        <!-- 三数据 -->
        <view class="ov-strip fade-row">
          <view class="ov"><text class="ov-n">{{ shown(pomoView) }}</text><text class="ov-c">累计番茄</text></view>
          <view class="ov"><text class="ov-n">{{ formatDuration(shown(minView) * 60) }}</text><text class="ov-c">累计专注</text></view>
          <view class="ov"><text class="ov-n">{{ shown(streakView) }}</text><text class="ov-c">连续天数</text></view>
        </view>

        <!-- 徽章墙 -->
        <view class="grid">
          <view
            v-for="(b, i) in badges"
            :key="b.id"
            class="badge fade-row press"
            :class="{ earned: b.earned }"
            :style="{
              borderColor: b.earned ? TIER_META[b.tier].color : 'transparent',
              animationDelay: Math.min(i * 20, 280) + 'ms',
            }"
          >
            <text class="b-icon">{{ b.earned ? b.icon : '🔒' }}</text>
            <text class="b-title">{{ b.title }}</text>
            <text class="b-desc">{{ b.desc }}</text>
            <view class="b-bar">
              <view class="b-fill" :style="{ width: Math.round((b.cur / b.goal) * 100) + '%', background: TIER_META[b.tier].color }" />
            </view>
            <text class="b-prog" :style="{ color: TIER_META[b.tier].color }">{{ b.cur }}/{{ b.goal }} · {{ TIER_META[b.tier].label }}</text>
            <text v-if="b.earned" class="b-unlock">{{ unlockLabel(b) }}</text>
          </view>
        </view>

        <view class="tip">完成番茄 +10 经验，每 5 分钟专注 +1，连续打卡每天 +5。升级可解锁称号，越往后越有挑战 💪</view>
        <view class="bottom-space" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.body { height: calc(100vh - 130rpx); }
.cnt { font-size: 24rpx; color: var(--p-primary, #e53935); font-weight: 700; }
.lv-card {
  margin: 18rpx 24rpx;
  border-radius: 28rpx;
  padding: 28rpx;
  color: #fff;
  background: var(--p-grad, linear-gradient(135deg, #f4708b, #d8415d));
  box-shadow: var(--p-shadow, 0 12rpx 30rpx rgba(216, 65, 93, 0.28));
}
.lv-left { display: flex; align-items: center; gap: 20rpx; }
.lv-badge {
  width: 108rpx; height: 108rpx; border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  border: 4rpx solid rgba(255, 255, 255, 0.8);
  display: flex; align-items: center; justify-content: center;
}
.lv-num { font-size: 32rpx; font-weight: 900; }
.lv-text { display: flex; flex-direction: column; gap: 6rpx; }
.lv-title { font-size: 34rpx; font-weight: 800; }
.lv-xp { font-size: 22rpx; opacity: 0.92; }
.lv-bar { height: 16rpx; border-radius: 999rpx; background: rgba(255, 255, 255, 0.28); margin-top: 24rpx; overflow: hidden; }
.lv-fill { height: 100%; border-radius: 999rpx; background: #fff; transition: width 0.4s ease; }
.lv-hint { display: block; margin-top: 10rpx; font-size: 22rpx; opacity: 0.9; }
.ov-strip {
  display: flex; margin: 6rpx 24rpx 18rpx;
  background: var(--p-card, #fff); border-radius: 24rpx; padding: 20rpx 0;
  box-shadow: 0 6rpx 18rpx rgba(240, 100, 130, 0.08);
}
.ov { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2rpx; }
.ov-n { font-size: 30rpx; font-weight: 800; color: var(--p-primary, #e53935); }
.ov-c { font-size: 22rpx; color: var(--p-sub, #999); }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18rpx; padding: 0 24rpx; }
.badge {
  background: var(--p-card, #fff);
  border-radius: 24rpx;
  padding: 24rpx 20rpx;
  border: 4rpx solid transparent;
  filter: grayscale(1);
  opacity: 0.65;
  box-shadow: 0 6rpx 18rpx rgba(240, 100, 130, 0.06);
  transition: transform 0.16s ease, opacity 0.3s ease, filter 0.3s ease;
  &:active { transform: scale(0.98); }
  &.earned {
    filter: none;
    opacity: 1;
    background: var(--p-soft, #fff7f8);
    /* 已解锁徽章：一圈柔光，让"拿到手"的成就感更明显 */
    box-shadow: 0 6rpx 22rpx rgba(240, 100, 130, 0.18), 0 0 0 6rpx rgba(255, 255, 255, 0.35) inset;
    animation: badgePop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
}
@keyframes badgePop {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.b-icon { font-size: 52rpx; }
.b-title { display: block; font-size: 26rpx; font-weight: 800; margin-top: 8rpx; }
.b-desc { display: block; font-size: 22rpx; color: var(--p-sub, #999); margin-top: 4rpx; min-height: 44rpx; }
.b-bar { height: 10rpx; border-radius: 999rpx; background: var(--p-border, #f1e6e9); margin-top: 12rpx; overflow: hidden; }
/* 进度条从左侧生长，配合徽章错峰入场更像"进度在推进" */
.b-fill { height: 100%; border-radius: 999rpx; transform-origin: left center; animation: fillGrow 0.6s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
@keyframes fillGrow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.b-prog { display: block; margin-top: 8rpx; font-size: 22rpx; font-weight: 700; }
.b-unlock { display: block; margin-top: 6rpx; font-size: 22rpx; color: var(--p-sub, #8d7b82); }
.tip { margin: 22rpx 28rpx 0; font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.7; text-align: center; }
.bottom-space { height: 80rpx; }
</style>
