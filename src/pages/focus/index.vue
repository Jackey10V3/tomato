<script setup lang="ts">
/**
 * 专注页（番茄ToDo 风格）：红白刻度圆环 + 整屏计时 + 底部开始主按钮
 * 待机：浅色版面，中央大圆环（内显 25:00），底部全宽开始键；运行中整屏沉浸变深。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { useTimer } from '@/composables/useTimer'
import { useChrome } from '@/composables/usePageChrome'
import { useSettingsStore } from '@/store/modules/settings'
import { useTaskStore } from '@/store/modules/task'
import { themeStyle } from '@/utils/theme'
import { MOTIVATIONS, WEEK_CN } from '@/utils/constant'
import NoisePlayer from '@/components/NoisePlayer.vue'
import type { SessionKind } from '@/types/focus'

const settings = useSettingsStore()
const taskStore = useTaskStore()
const { statusBarH } = useChrome()

const timer = useTimer()
const style = computed(() => themeStyle(settings.s.theme))
// 顶层解包：返回对象中嵌套的 ref 在模板里不会自动解包
const st = timer.st
const bigText = timer.bigText
const progress = timer.progress

const kindLabel: Record<SessionKind, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
}
const kindEmoji: Record<SessionKind, string> = {
  focus: '🍅',
  shortBreak: '🌿',
  longBreak: '☕',
}

const todayText = ref('')
const greeting = ref('')
const motivation = ref('')

function pickQuote() {
  return MOTIVATIONS[(Math.random() * MOTIVATIONS.length) | 0]
}
function bootText() {
  const d = new Date()
  const h = d.getHours()
  const week = WEEK_CN[d.getDay()]
  todayText.value = `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`
  greeting.value = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好'
  motivation.value = h < 6 ? '深夜专注，格外清醒 🌙' : pickQuote()
}

// ---------- 开始面板 ----------
const sheetOpen = ref(false)
const startGuard = reactive({ strict: false, studyHard: false })
const selectedTaskId = ref<string>('')
const todayTasks = computed(() => taskStore.listTasks('today'))
const selectedTask = computed(() => taskStore.byId(selectedTaskId.value))

function openSheet() {
  startGuard.strict = settings.s.focusGuard.strict
  startGuard.studyHard = settings.s.focusGuard.studyHard
  selectedTaskId.value = ''
  sheetOpen.value = true
}
function confirmStart() {
  sheetOpen.value = false
  timer.startFocus({
    taskId: selectedTask.value?._id,
    taskTitle: selectedTask.value?.title,
    guard: { strict: startGuard.strict, studyHard: startGuard.studyHard },
  })
}
function setDefaultMode(m: 'countdown' | 'countup') {
  settings.update({ defaultMode: m })
}

// ---------- 控制 ----------
function onPrimary() {
  if (st.status === 'idle') {
    openSheet()
    return
  }
  if (st.status === 'running') {
    if (!timer.pause()) {
      uni.showToast({ title: '严格模式：专注期间不可暂停', icon: 'none' })
    }
    return
  }
  timer.resume()
}
function onRunningTap() {
  // 运行中：底部主键切换为「暂停 / 继续」；普通模式点主键暂停
  onPrimary()
}
function onFinishNow() {
  uni.showModal({
    title: '结束本次专注',
    content: '按当前时长记为一次完成的专注，不进入休息？',
    confirmText: '结束并记录',
    success: r => {
      if (r.confirm) timer.finishSuccess()
    },
  })
}
function onGiveUp() {
  uni.showModal({
    title: '放弃本次专注',
    content: '放弃后本次番茄不计入完成数量，确定吗？',
    confirmText: '放弃',
    confirmColor: '#e53935',
    success: r => {
      if (r.confirm) {
        if (!timer.giveUp()) {
          uni.showToast({ title: '严格模式：不允许放弃，请坚持完成', icon: 'none' })
        }
      }
    },
  })
}
function onSkipBreak() {
  timer.endCurrent(st.kind) // 手动结束休息，回到待机
}
function goTaskTab() {
  uni.switchTab({ url: '/pages/task/index' })
}

// ---------- 学霸模式离席监测（App 退后台 / H5 隐藏） ----------
function reportBack() {
  const r = timer.notifyBack()
  if (!r) return
  if (r.penalized) {
    uni.vibrateLong()
    uni.showModal({
      title: '本次专注已作废',
      content: r.reason || '离席过多',
      showCancel: false,
    })
  } else {
    uni.vibrateShort()
    uni.showToast({
      title: `⚠ 离开 ${r.leaveSec} 秒 · 第 ${r.warnIndex} 次警告（${settings.s.focusGuard.warnLimit} 次后作废）`,
      icon: 'none',
      duration: 3000,
    })
  }
}
function onAppHide() {
  if (st.status === 'running' && timer.isFocus() && st.studyHard) {
    timer.notifyLeft()
  }
}

// 结束事件 → 提示 / 结算弹层
const doneModal = ref(false)
timer.on('finished', () => {
  uni.vibrateShort()
  doneModal.value = true
})
timer.on('giveup', () => {
  uni.showToast({ title: '已放弃，休息一下吧', icon: 'none' })
})
timer.on('abandoned', () => {
  /* reportBack 已弹窗 */
})

// 仅当应用真正退到后台才判定“离席”（切 tab 不算）
const disposers: (() => void)[] = []
onMounted(() => {
  bootText()
  if (timer.leaveStart.value > 0) reportBack()

  const uniAny = uni as unknown as {
    onAppHide?: (fn: () => void) => void
    offAppHide?: (fn: () => void) => void
  }
  if (typeof uniAny.onAppHide === 'function') {
    uniAny.onAppHide(onAppHide)
    disposers.push(() => uniAny.offAppHide?.(onAppHide))
  }
  if (typeof document !== 'undefined') {
    const onVis = () => {
      if (document.hidden) onAppHide()
      else reportBack()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onAppHide)
    window.addEventListener('focus', reportBack)
    disposers.push(() => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onAppHide)
      window.removeEventListener('focus', reportBack)
    })
  }
})
onShow(() => {
  bootText()
  reportBack()
})
onUnload(() => {
  disposers.forEach(fn => fn())
  timer.notifyBack()
})

const runningFocus = computed(() => timer.isFocus() && st.status !== 'idle')
const dialPct = computed(() => Math.max(0, Math.min(100, progress.value * 100)))
</script>

<template>
  <view class="screen" :class="{ deep: st.status !== 'idle' }" :style="[style, { paddingTop: statusBarH + 'px' }]">
    <!-- 顶部：极简 -->
    <view class="top">
      <view class="today">{{ todayText }}</view>
      <view class="top-right">
        <text class="gear" @click="openSheet">⚙</text>
      </view>
    </view>

    <!-- 中央：刻度圆环 + 时间 -->
    <view class="dial-wrap">
      <view class="dial">
        <!-- 刻度刻度层 -->
        <view class="ticks" />
        <!-- 进度弧 -->
        <view class="arc" :style="[{ background: `conic-gradient(var(--dial) ${dialPct}%, var(--dial-track) 0)` }]" />
        <!-- 中心盘 -->
        <view class="core">
          <text class="core-kind">{{ st.kind === 'focus' ? '' : kindEmoji[st.kind] }}<text v-if="st.kind !== 'focus'" class="kind-txt"> {{ kindLabel[st.kind] }}</text></text>
          <view class="time">{{ bigText }}</view>
          <text class="mode">{{ st.mode === 'countup' ? '正向计时' : '倒计时' }}</text>
        </view>
      </view>

      <!-- 任务胶囊 / 激励 -->
      <view v-if="st.taskTitle" class="task-pill" @click="goTaskTab">
        <text class="task-text">📌 {{ st.taskTitle }}</text>
        <text class="pill-arrow">›</text>
      </view>
      <view v-else class="motiv" :class="{ dim: st.status !== 'idle' }">
        <text>{{ st.status === 'idle' ? motivation : motivation }}</text>
      </view>

      <view v-if="runningFocus && st.strict" class="guard-tag">🔒 严格模式</view>
      <view v-else-if="runningFocus && st.studyHard" class="guard-tag">🎓 学霸模式 · 离席超限作废</view>
    </view>

    <!-- 底部操作区（番茄ToDo 主操作集中在底部） -->
    <view class="dock">
      <!-- 待机：模式 + 开始主按钮 -->
      <template v-if="st.status === 'idle'">
        <view class="mode-seg">
          <view class="seg" :class="{ on: settings.s.defaultMode === 'countdown' }" @click="setDefaultMode('countdown')">倒计时</view>
          <view class="seg" :class="{ on: settings.s.defaultMode === 'countup' }" @click="setDefaultMode('countup')">正向计时</view>
        </view>
        <view class="start-btn" @click="onPrimary">
          <text class="start-emoji">▶</text>
          <text class="start-text">开始专注</text>
          <text class="start-min">{{ settings.s.timer.focusMin }}′</text>
        </view>
        <text class="start-hint">开始前可选择一个任务 / 开启严格·学霸模式</text>
      </template>

      <!-- 运行中 -->
      <template v-else-if="st.status === 'running'">
        <template v-if="timer.isFocus()">
          <view v-if="!st.strict" class="run-row">
            <view class="run-btn soft" @click="onRunningTap"><text class="e">⏸</text><text>暂停</text></view>
            <view class="run-btn main" @click="onFinishNow"><text class="e">🏁</text><text>结束</text></view>
            <view class="run-btn soft danger" @click="onGiveUp"><text class="e">✕</text><text>放弃</text></view>
          </view>
          <view v-else class="strict-line"><text>坚持住 · 严格模式不可中断</text></view>
        </template>
        <template v-else>
          <view class="run-row">
            <view class="run-btn soft" @click="onRunningTap"><text class="e">⏸</text><text>暂停</text></view>
            <view class="run-btn soft danger" @click="onSkipBreak"><text class="e">⏭</text><text>结束休息</text></view>
          </view>
        </template>
      </template>

      <!-- 暂停态 -->
      <template v-else>
        <view class="paused-line">已暂停 · 剩余 {{ bigText }}</view>
        <view class="start-btn small" @click="onPrimary"><text class="start-emoji">▶</text><text class="start-text">继续</text></view>
      </template>
    </view>

    <!-- 白噪音（空闲时展示，沉浸时不打扰） -->
    <view v-if="st.status === 'idle'" class="noise-box"><NoisePlayer /></view>

    <!-- 开始面板 -->
    <view v-if="sheetOpen" class="mask" @click="sheetOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <text class="sheet-title">开始专注</text>
          <text class="sheet-close" @click="sheetOpen = false">✕</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view class="field">
            <text class="f-label">选择任务</text>
            <scroll-view scroll-x class="task-scroll">
              <view v-for="t in todayTasks" :key="t._id" class="task-opt" :class="{ on: selectedTaskId === t._id }" @click="selectedTaskId = selectedTaskId === t._id ? '' : t._id">
                <text class="task-opt-title">{{ t.title }}</text>
                <text class="task-opt-sub">🍅 {{ t.done }}/{{ t.estimate || '∞' }}</text>
              </view>
              <view v-if="!todayTasks.length" class="empty-tip">今天还没有任务，去「任务」页添加吧</view>
            </scroll-view>
          </view>
          <view class="field">
            <text class="f-label">本次 {{ settings.s.timer.focusMin }} 分钟 · {{ settings.s.defaultMode === 'countup' ? '正向计时' : '倒计时' }}</text>
            <view class="guard-row" :class="{ dim: settings.s.defaultMode === 'countup' }" @click="settings.s.defaultMode !== 'countup' && (startGuard.strict = !startGuard.strict)">
              <view class="guard-info">
                <text class="g-name">严格模式</text>
                <text class="g-desc">{{ settings.s.defaultMode === 'countup' ? '正向计时无自然终点，不能开启严格模式' : '禁止暂停 / 结束 / 放弃，必须坚持到底' }}</text>
              </view>
              <view class="sw" :class="{ on: startGuard.strict && settings.s.defaultMode !== 'countup' }" />
            </view>
            <view class="guard-row" @click="startGuard.studyHard = !startGuard.studyHard">
              <view class="guard-info">
                <text class="g-name">学霸模式</text>
                <text class="g-desc">离开 App 会警告，达 {{ settings.s.focusGuard.warnLimit }} 次或超时作废</text>
              </view>
              <view class="sw" :class="{ on: startGuard.studyHard }" />
            </view>
          </view>
        </scroll-view>
        <view class="sheet-actions">
          <view class="pill" @click="confirmStart"><text>🍅 开始专注</text></view>
        </view>
      </view>
    </view>

    <!-- 结算弹层 -->
    <view v-if="doneModal" class="mask">
      <view class="sheet center-sheet">
        <text class="celebrate-emoji">🎉</text>
        <text class="celebrate-title">{{ st.kind === 'focus' ? '专注完成！' : '阶段结束' }}</text>
        <text class="celebrate-sub">已记录到统计，去看看你的专注足迹吧</text>
        <view class="pill" @click="doneModal = false"><text>好的</text></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--p-bg, #faf6f3);
  color: var(--p-text, #333);
  box-sizing: border-box;
  /* 运行中切到主题深色沉浸 */
  --dial: var(--p-primary, #e53935);
  --dial-track: rgba(0, 0, 0, 0.07);
  &.deep {
    background: linear-gradient(165deg, var(--p-deep, #c62828) 0%, var(--p-light, #ef5350) 130%);
    color: #fff;
    --dial-track: rgba(255, 255, 255, 0.22);
    --dial: #fff;
  }
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 36rpx 0;
  .today { font-size: 24rpx; opacity: 0.75; }
  .top-right .gear { font-size: 36rpx; opacity: 0.7; padding: 6rpx; }
}

.dial-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 40rpx;
}
.dial {
  position: relative;
  width: 540rpx;
  height: 540rpx;
  .ticks {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
      repeating-conic-gradient(rgba(0, 0, 0, 0.08) 0deg 1.5deg, transparent 1.5deg 6deg);
    opacity: 0.9;
  }
  .screen.deep & .ticks {
    background:
      repeating-conic-gradient(rgba(255, 255, 255, 0.25) 0deg 1.5deg, transparent 1.5deg 6deg);
  }
  .arc {
    position: absolute;
    inset: 14rpx;
    border-radius: 50%;
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 26rpx), #000 calc(100% - 25rpx));
    mask: radial-gradient(farthest-side, transparent calc(100% - 26rpx), #000 calc(100% - 25rpx));
    transform: rotate(-90deg);
  }
  .core {
    position: absolute;
    inset: 40rpx;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4rpx;
    .core-kind { font-size: 28rpx; opacity: 0.7; }
    .time {
      font-size: 132rpx;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: 2rpx;
      font-variant-numeric: tabular-nums;
    }
    .mode { font-size: 22rpx; opacity: 0.6; letter-spacing: 4rpx; }
  }
}
.screen:not(.deep) .core .time { color: var(--p-text, #333); }

.task-pill {
  margin-top: 30rpx;
  max-width: 80%;
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: var(--p-card, #fff);
  color: var(--p-text, #333);
  border-radius: 999rpx;
  padding: 12rpx 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  .task-text { font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill-arrow { font-size: 30rpx; color: var(--p-sub, #999); }
  .screen.deep & { background: rgba(255, 255, 255, 0.16); color: #fff; }
  .screen.deep & .pill-arrow { color: rgba(255, 255, 255, 0.7); }
}
.motiv {
  margin-top: 26rpx;
  font-size: 24rpx;
  opacity: 0.85;
  text-align: center;
  &.dim { opacity: 0.5; }
}
.guard-tag { margin-top: 14rpx; font-size: 22rpx; opacity: 0.85; }

.dock {
  padding: 10rpx 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  .mode-seg {
    display: flex;
    border-radius: 999rpx;
    background: var(--p-card, #fff);
    padding: 5rpx;
    margin-bottom: 20rpx;
    border: 2rpx solid rgba(0, 0, 0, 0.05);
    .screen.deep & { background: rgba(255, 255, 255, 0.18); border: none; }
    .seg {
      padding: 6rpx 34rpx;
      border-radius: 999rpx;
      font-size: 24rpx;
      color: var(--p-sub, #999);
      &.on { background: var(--p-primary, #e53935); color: #fff; font-weight: 700; }
    }
  }
  .start-btn {
    width: 100%;
    height: 108rpx;
    border-radius: 999rpx;
    background: var(--p-primary, #e53935);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    box-shadow: 0 14rpx 36rpx rgba(229, 57, 53, 0.32);
    &.small { width: auto; padding: 0 80rpx; height: 100rpx; }
    .start-emoji { font-size: 30rpx; }
    .start-text { font-size: 36rpx; font-weight: 800; letter-spacing: 2rpx; }
    .start-min { font-size: 22rpx; opacity: 0.9; }
  }
  .start-hint { margin-top: 18rpx; font-size: 20rpx; color: var(--p-sub, #999); }
  .run-row { display: flex; gap: 40rpx; }
  .run-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
    font-size: 22rpx;
    .e {
      width: 104rpx;
      height: 104rpx;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 44rpx;
    }
    &.main .e { background: var(--p-primary, #e53935); box-shadow: 0 10rpx 26rpx rgba(229, 57, 53, 0.35); }
    &.soft .e { background: rgba(255, 255, 255, 0.2); border: 2rpx solid rgba(255, 255, 255, 0.3); }
    &.danger .e { background: rgba(0, 0, 0, 0.25); }
  }
  .strict-line { font-size: 26rpx; opacity: 0.9; }
  .paused-line { margin-bottom: 20rpx; font-size: 24rpx; opacity: 0.85; }
}
.noise-box { padding: 0 36rpx 40rpx; }

/* 弹层 */
.mask {
  position: fixed;
  top: 0; right: 0; bottom: 0; left: 0;
  background: rgba(10, 6, 4, 0.5);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: #fff;
  color: #333;
  border-radius: 40rpx 40rpx 0 0;
  padding: 30rpx 32rpx calc(30rpx + env(safe-area-inset-bottom));
  .sheet-head { display: flex; justify-content: space-between; align-items: center; }
  .sheet-title { font-size: 32rpx; font-weight: 700; }
  .sheet-close { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; background: #f2efec; border-radius: 50%; }
  .sheet-body { max-height: 54vh; }
  .field { margin-top: 26rpx; }
  .f-label { font-size: 24rpx; color: var(--p-sub, #999); display: block; margin-bottom: 14rpx; }
  .task-scroll { white-space: nowrap; }
  .task-opt {
    display: inline-flex; flex-direction: column;
    background: #f6f3f0; border-radius: 20rpx; padding: 16rpx 24rpx; margin-right: 16rpx;
    border: 3rpx solid transparent; max-width: 320rpx; vertical-align: top;
    &.on { background: #ffeceb; border-color: var(--p-primary, #e53935); }
    .task-opt-title { font-size: 26rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-opt-sub { font-size: 20rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
  }
  .empty-tip { display: inline-block; font-size: 22rpx; color: var(--p-sub, #999); padding: 12rpx 0; }
  .guard-row {
    display: flex; align-items: center; justify-content: space-between;
    background: #faf7f4; border-radius: 20rpx; padding: 18rpx 22rpx; margin-top: 14rpx;
    &.dim { opacity: 0.5; }
    .guard-info { flex: 1; display: flex; flex-direction: column; }
    .g-name { font-size: 28rpx; font-weight: 600; }
    .g-desc { font-size: 20rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
    .sw {
      width: 92rpx; height: 52rpx; border-radius: 999rpx; background: #d9d2cc; position: relative; flex-shrink: 0; transition: background 0.2s;
      &::after { content: ''; position: absolute; top: 6rpx; left: 6rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #fff; transition: transform 0.2s; }
      &.on { background: var(--p-primary, #e53935); &::after { transform: translateX(40rpx); } }
    }
  }
  .sheet-actions { margin-top: 30rpx; }
  &.center-sheet {
    display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding-top: 60rpx;
    .celebrate-emoji { font-size: 100rpx; }
    .celebrate-title { font-size: 40rpx; font-weight: 800; }
    .celebrate-sub { font-size: 24rpx; color: var(--p-sub, #999); margin-bottom: 30rpx; }
  }
}
</style>
