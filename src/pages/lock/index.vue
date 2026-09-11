<script setup lang="ts">
/** 锁机：启动一段不可干扰的专注锁屏（全屏沉浸倒计时，仅可提前结束解锁） */
import { computed, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { useTimer } from '@/composables/useTimer'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { themeStyle } from '@/utils/theme'

const settings = useSettingsStore()
const timer = useTimer()
const { statusBarH } = useChrome()
const style = computed(() => themeStyle(settings.s.theme))

const st = timer.st
const bigText = timer.bigText

const minutes = ref(25)
const MIN_OPTS = [15, 25, 45, 60, 90]
const locked = computed(() => st.status !== 'idle')

function lock() {
  timer.startFocus({ taskTitle: '番茄锁机', mode: 'countdown', minutes: minutes.value })
  uni.vibrateShort()
}
function unlock() {
  uni.showModal({
    title: '结束锁机',
    content: '提前离开会按当前时长记录完成，确定解锁？',
    confirmColor: '#e53935',
    success: r => r.confirm && timer.finishSuccess(),
  })
}

let hDone: (() => void) | null = null
function onDone() {
  if (hDone) return
  hDone = () => {
    uni.showToast({ title: '锁机结束 🎉', icon: 'success' })
  }
  timer.on('finished', hDone)
}

onShow(() => {
  if (!locked.value) onDone()
})
onUnload(() => {
  if (hDone) { timer.off('finished', hDone); hDone = null }
  timer.notifyBack()
})
</script>

<template>
  <view class="screen deep" :style="[style, { paddingTop: statusBarH + 'px' }]">
    <view class="top"><text class="title">🍅 番茄锁机</text></view>

    <view v-if="!locked" class="setup">
      <text class="intro">选择锁机时长，开始后请放下手机，坚持到你设定的时间，中途只能提前结束解锁</text>
      <view class="opts">
        <view v-for="m in MIN_OPTS" :key="m" class="opt" :class="{ on: minutes === m }" @click="minutes = m">{{ m }} 分钟</view>
      </view>
      <view class="lock-btn" @click="lock"><text>🔒 开始锁机</text></view>
      <text class="hint">手机端将由原生权限或前台服务实现全屏锁机（TODO M7）；此处为演示计时</text>
    </view>

    <view v-else class="locked">
      <view class="ring">
        <text class="time">{{ bigText }}</text>
        <text class="cap">锁机中 · 坚持到底</text>
      </view>
      <text class="quote">放下手机，专注此刻 📵</text>
      <view class="unlock" @click="unlock"><text>结束锁机</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.screen.deep {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a2a6c 0%, #3a5a9c 60%, #1a2a6c 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
}
.top { padding: 20rpx 34rpx; }
.title { font-size: 38rpx; font-weight: 800; }
.setup { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 50rpx; }
.intro { font-size: 26rpx; color: rgba(255,255,255,0.9); text-align: center; line-height: 1.8; }
.opts { display: flex; flex-wrap: wrap; gap: 18rpx; justify-content: center; margin-top: 44rpx; }
.opt {
  background: rgba(255,255,255,0.14);
  border: 2rpx solid rgba(255,255,255,0.3);
  border-radius: 999rpx; padding: 14rpx 34rpx; font-size: 28rpx;
  &.on { background: #fff; color: #1a2a6c; font-weight: 800; }
}
.lock-btn {
  margin-top: 60rpx;
  background: #fff; color: #1a2a6c;
  border-radius: 999rpx; padding: 24rpx 100rpx;
  font-size: 34rpx; font-weight: 800;
  box-shadow: 0 14rpx 40rpx rgba(0, 0, 0, 0.3);
}
.hint { margin-top: 40rpx; font-size: 20rpx; color: rgba(255,255,255,0.6); text-align: center; }
.locked { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30rpx; }
.ring {
  width: 420rpx; height: 420rpx; border: 6rpx solid rgba(255,255,255,0.9); border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  .time { font-size: 96rpx; font-weight: 800; font-variant-numeric: tabular-nums; }
  .cap { font-size: 22rpx; color: rgba(255,255,255,0.85); margin-top: 6rpx; }
}
.quote { font-size: 24rpx; opacity: 0.85; }
.unlock {
  background: rgba(0,0,0,0.3); border: 2rpx solid rgba(255,255,255,0.4);
  border-radius: 999rpx; padding: 16rpx 60rpx; font-size: 26rpx;
}
</style>
