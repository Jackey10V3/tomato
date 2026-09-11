<script setup lang="ts">
/** 二级专注页（图三风格）：整屏沉浸渐变压暗，顶部励志语录，细环大时间，底部任务名/进行中 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onLoad, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useTimer } from '@/composables/useTimer'
import { useTaskStore } from '@/store/modules/task'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { useCanvasBg } from '@/composables/useCanvasBg'
import { platform } from '@/platform'
import { themeStyle, mixHex, buildTodoColorMap } from '@/utils/theme'
import { MOTIVATIONS } from '@/utils/constant'
import { ACHIEVEMENTS } from '@/store/modules/focus'
import { storage } from '@/utils/storage'

const store = useTaskStore()
const settings = useSettingsStore()
const timer = useTimer()
const { statusBarH, goBack } = useChrome()
const { layoutClass } = useResponsive()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))

const st = timer.st
const bigText = timer.bigText
const progress = timer.progress

const taskId = ref('')
const title = ref('')
const mode = ref<'countdown' | 'countup'>('countdown')
const minutes = ref(25)
const quote = ref(MOTIVATIONS[0])
/** 该待办的专属颜色（首页卡片同色），用于沉浸背景 */
const taskColor = ref('')
const accent = computed(() => {
  if (!taskColor.value) return ''
  return `linear-gradient(180deg, ${mixHex(taskColor.value, '#000000', 0.45)} 0%, ${taskColor.value} 55%, ${mixHex(taskColor.value, '#ffffff', 0.35)} 100%)`
})

/**
 * 沉浸式底色：把 html 画布刷成同款渐变，盖住小白条手势区下方露出的白底。
 * 有专属色用专属色渐变，否则用主题渐变（与 .screen.deep 的背景保持一致）。
 */
const canvasBg = useCanvasBg(
  () =>
    accent.value ||
    `linear-gradient(180deg, ${style.value['--p-deep'] || '#1a2a6c'} 0%, ${style.value['--p-light'] || '#3a5a9c'} 55%, ${style.value['--p-deep'] || '#1a2a6c'} 100%)`,
)
watch(accent, () => canvasBg.apply())

/** 每次进入专注换一条励志语：顺序轮换 + 随机步进，不连着重复，并能循环到全部文案 */
function pickQuote() {
  const len = MOTIVATIONS.length
  const raw = storage.get<string>('focus:quoteIdx')
  const last = raw ? Number(raw) : -1
  const step = 1 + ((Math.random() * 3) | 0) // 每次前进 1~3 条
  const idx = ((Number.isFinite(last) && last >= 0 ? last : -1) + step) % len
  storage.set('focus:quoteIdx', String(idx))
  quote.value = MOTIVATIONS[idx]
}

onLoad(q => {
  pickQuote()
  const id = q?.id || ''
  const t = store.byId(id)
  if (!t) {
    uni.showToast({ title: '待办不存在', icon: 'none' })
    setTimeout(goBack, 600)
    return
  }
  taskId.value = id
  title.value = t.title
  mode.value = t.mode
  minutes.value = t.minutes || 25
  // 专属色：优先自定义色，否则用与首页一致的自动配色（每个待办一个颜色）
  taskColor.value = t.color || buildTodoColorMap(store.tasks, settings.themeDef.primary).get(t._id) || ''
  onLoadDone()
  // 已有进行中的会话时不要静默重启（否则会丢掉已累计的时长与轮次）
  if (st.status === 'idle') {
    start()
  } else if (st.taskId !== id) {
    title.value = st.taskTitle || title.value
    uni.showToast({ title: '已有进行中的专注，请先结束它', icon: 'none', duration: 2200 })
  }
})

function start() {
  timer.startFocus({
    taskId: taskId.value,
    taskTitle: title.value,
    mode: mode.value,
    minutes: mode.value === 'countdown' ? minutes.value : undefined,
  })
}
function onPrimary() {
  if (st.status === 'idle') {
    start()
    return
  }
  if (st.status === 'running') {
    timer.pause()
    return
  }
  timer.resume()
}
const confirmMode = ref<'' | 'finish' | 'giveup' | 'exit'>('')
function finishNow() {
  confirmMode.value = 'finish'
}
function onGiveUp() {
  confirmMode.value = 'giveup'
}
function doConfirm() {
  const m = confirmMode.value
  confirmMode.value = ''
  if (m === 'finish' || m === 'exit') {
    // 严格模式下不允许提前结束 / 放弃，需给出反馈而不是静默失败
    if (!timer.finishSuccess()) uni.showToast({ title: '严格模式专注中，不能提前结束', icon: 'none' })
  } else if (m === 'giveup') {
    if (timer.giveUp()) {
      uni.showToast({ title: '已放弃，本次不记录', icon: 'none' })
      setTimeout(goBack, 600)
    } else {
      uni.showToast({ title: '严格模式专注中，不能放弃', icon: 'none' })
    }
  }
}
function cancelConfirm() {
  confirmMode.value = ''
}

/** 侧滑返回 / 返回键：专注进行中先拦下来弹确认卡片，避免误退丢失专注 */
onBackPress(() => {
  if (confirmMode.value) {
    cancelConfirm()
    return true
  }
  if (idle.value) return false // 未开始：允许正常返回
  confirmMode.value = 'exit'
  return true
})
/** 统一的庆祝反馈：光环扩散 + 撒花（普通完成也会播，不再只在解锁成就时才有） */
function celebrate(ms = 2400) {
  showConfetti.value = true
  setTimeout(() => (showConfetti.value = false), ms)
}

function goDone() {
  platform.haptic.light()
  celebrate(1600)
  uni.showToast({ title: '已记录 🍅', icon: 'success', duration: 1200 })
  // 留出时间让用户看到落袋动效，再返回
  setTimeout(goBack, 1500)
}

// 单次任务计时结束（倒计时归零 / 手动结束 / 跳过）→ 记录并返回
let hDone: (() => void) | null = null
let hAch: ((p?: unknown) => void) | null = null
let hLv: ((p?: unknown) => void) | null = null
const showConfetti = ref(false)
/**
 * 撒花元素：数量更多、左右错开、大小/时长/延迟各异，避免"整齐一排掉下来"的僵硬感。
 * 分两批出场（delay 阶梯），视觉上是"连续两波"而不是一次性闪一下。
 */
const CONFETTI_EMOJI = ['🍅', '🎉', '✨', '🍅', '🌟', '🎊', '🍅', '💫', '🥳', '🍅', '⭐', '🎈', '🍅', '✨']
const confetti = computed(() =>
  CONFETTI_EMOJI.map((e, i) => ({
    e,
    left: 3 + ((i * 7.3 + (i % 3) * 2.6) % 94),
    delay: (i % 5) * 0.1 + Math.floor(i / 5) * 0.16,
    dur: 1.5 + (i % 4) * 0.3,
    size: 34 + (i % 3) * 14,
  })),
)

/** 新成就解锁 → 提示 + 撒花 */
function onAchievement(payload?: unknown) {
  const ids = (payload as string[]) || []
  const names = ids.map(id => ACHIEVEMENTS.find(a => a.id === id)?.title).filter(Boolean)
  if (!names.length) return
  celebrate(2400)
  uni.showToast({ title: `🎉 解锁成就：${names.join('、')}`, icon: 'none', duration: 2600 })
}
function onLoadDone() {
  if (hDone) return
  hDone = () => goDone()
  timer.on('finished', hDone)
  hAch = (p?: unknown) => onAchievement(p)
  timer.on('achievement', hAch)
  hLv = (p?: unknown) => {
    const info = p as { level?: number; title?: string } | undefined
    if (info?.level) {
      celebrate(2400)
      uni.showToast({ title: `🚀 升级到 Lv.${info.level} ${info.title || ''}`, icon: 'none', duration: 2600 })
    }
  }
  timer.on('levelup', hLv)
}

const dialPct = computed(() => Math.max(0, Math.min(100, progress.value * 100)))

// ---------- 禅模式：运行中持续无操作 15s，隐去顶栏/操作区只留呼吸环；点屏唤醒 ----------
const ZEN_AFTER_MS = 15000
const zen = ref(false)
let lastActive = Date.now()
let zenTimer: ReturnType<typeof setInterval> | null = null

function markActive() {
  lastActive = Date.now()
  if (zen.value) zen.value = false
}
function checkZen() {
  // 只在"专注运行中"进入禅模式：暂停/待开始时界面本身就是操作对象
  if (running.value && !zen.value && Date.now() - lastActive >= ZEN_AFTER_MS) {
    zen.value = true
  }
}
onMounted(() => {
  zenTimer = setInterval(checkZen, 3000)
})
onUnmounted(() => {
  if (zenTimer) clearInterval(zenTimer)
  zenTimer = null
})
// 离开页面再回来/从暂停恢复时，重新计时并退出禅模式
watch(() => st.status, () => markActive())
/**
 * 进度弧：conic-gradient 画一圈，再用 mask 抠成环带。
 * 每秒前进的角度极小（25 分钟全程 ≈ 0.24°/秒），所以看起来是连续走的，不需要 CSS 过渡。
 */
const progStyle = computed(() => {
  const pct = st.mode === 'countup' ? 0 : dialPct.value
  const deg = st.status === 'idle' ? 0 : Math.max(0, Math.min(360, (pct / 100) * 360))
  return {
    background: `conic-gradient(from -90deg, rgba(255,255,255,0.96) ${deg}deg, rgba(255,255,255,0) ${deg}deg 360deg)`,
  }
})
const idle = computed(() => st.status === 'idle')
const running = computed(() => st.status === 'running')
const caption = computed(() => {
  if (idle.value) return mode.value === 'countdown' ? `倒计时 ${minutes.value} 分钟` : '正向计时'
  if (running.value) return mode.value === 'countdown' ? `剩余 ${bigText.value}` : `已专注 ${bigText.value}`
  return '已暂停'
})
const statusText = computed(() => (idle.value ? '待开始' : running.value ? '进行中' : '已暂停'))

onUnload(() => {
  if (hDone) {
    timer.off('finished', hDone)
    hDone = null
  }
  if (hAch) {
    timer.off('achievement', hAch)
    hAch = null
  }
  if (hLv) {
    timer.off('levelup', hLv)
    hLv = null
  }
  timer.notifyBack()
})
</script>

<template>
  <view
    class="screen deep"
    :class="[layoutClass, { zen: zen && running }]"
    :style="[style, { paddingTop: statusBarH + 'px' }, accent ? { background: accent } : {}]"
    @touchstart="markActive"
    @click="markActive"
  >
    <!-- 背景光晕（跟随该待办的专属色，进一步区分不同专注） -->
    <view
      class="glow"
      :style="{ background: `radial-gradient(circle at 70% 26%, ${(taskColor || style['--p-light'])}55, transparent 62%)` }"
    />

    <!-- 顶部：返回 + 励志语 -->
    <view class="topbar">
      <text class="back" @click="goBack">←</text>
      <view class="quote">
        <text>{{ quote }}</text>
      </view>
      <view class="bar-right" />
    </view>

    <!-- 横屏：中央环与底部操作区放进同一容器，垂直居中于剩余空间 -->
    <view class="landscape-body">
    <!-- 中央环 -->
    <view class="center">
      <view class="ring" :class="{ breathe: st.status !== 'idle', hold: st.status === 'paused', paused: st.status === 'paused' }">
        <view class="ring-prog" :style="progStyle" />
        <text class="time">{{ bigText }}</text>
        <text class="cap">{{ caption }}</text>
      </view>
    </view>

    <!-- 完成反馈：扩散光环 + 撒花 -->
    <view v-if="showConfetti" class="ring-pulse" />
    <view v-if="showConfetti" class="confetti">
      <text
        v-for="(c, i) in confetti"
        :key="i"
        class="cf"
        :style="{
          left: c.left + '%',
          fontSize: c.size + 'rpx',
          animationDelay: c.delay + 's',
          animationDuration: c.dur + 's',
        }"
      >{{ c.e }}</text>
    </view>

    <!-- 底部：任务名 + 状态 + 控制 -->
    <view class="bottom">
      <text class="task-name">{{ title }}</text>
      <text class="status">{{ statusText }}</text>

      <view class="controls">
        <template v-if="idle">
          <view class="pill-main" @click="onPrimary"><text>▶ 开始专注</text></view>
        </template>
        <template v-else-if="running">
          <view class="row">
            <view class="btn-sub" @click="onPrimary"><text class="e">⏸</text><text>暂停</text></view>
            <view class="btn-sub strong" @click="finishNow"><text class="e">🏁</text><text>结束</text></view>
            <view class="btn-sub ghost" @click="onGiveUp"><text class="e">✕</text><text>放弃</text></view>
          </view>
        </template>
        <template v-else>
          <view class="pill-main" @click="onPrimary"><text>▶ 继续</text></view>
          <text class="end-link" @click="finishNow">结束并记录 ›</text>
        </template>
      </view>
    </view>
    </view>
    <!-- /landscape-body -->

    <!-- 结束 / 放弃 二次确认 -->
    <view v-if="confirmMode" class="pop-mask" @click="cancelConfirm">
      <view class="pop-card" @click.stop>
        <text class="cf-emoji">{{ confirmMode === 'giveup' ? '😢' : confirmMode === 'exit' ? '🚪' : '🍅' }}</text>
        <text class="cf-title">{{ confirmMode === 'giveup' ? '确定要放弃吗？' : confirmMode === 'exit' ? '要离开专注页吗？' : '提前结束本次专注？' }}</text>
        <text class="cf-desc">
          {{ confirmMode === 'giveup'
            ? '放弃的专注不会计入统计，也不会种下番茄。'
            : confirmMode === 'exit'
              ? '离开会按当前时长结束本次专注并记录到统计。'
              : '已专注的时长会记录到统计里，但这颗番茄不算自然完成。' }}
        </text>
        <view class="cf-actions">
          <view class="cf-btn cancel" @click="cancelConfirm"><text>{{ confirmMode === 'exit' ? '继续专注' : '再坚持一下' }}</text></view>
          <view class="cf-btn ok" @click="doConfirm">
            <text>{{ confirmMode === 'giveup' ? '确认放弃' : confirmMode === 'exit' ? '结束并离开' : '结束并记录' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.screen.deep {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: #fff;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--p-deep, #1a2a6c) 0%, var(--p-light, #3a5a9c) 55%, var(--p-deep, #1a2a6c) 100%);
  transition: background 0.4s;
}
/* 禅模式：顶栏/操作区缓缓隐去，只留呼吸环。点屏即唤醒（markActive） */
.topbar,
.bottom { transition: opacity 0.6s ease; }
.screen.deep.zen .topbar,
.screen.deep.zen .bottom {
  opacity: 0;
  pointer-events: none;
}
/* 关键：bottom 的入场动画 riseIn 是 fill-mode:both，动画填充的 opacity:1
   在层叠里优先于上面的 opacity:0，必须显式移除动画，隐身才能生效 */
.screen.deep.zen .bottom { animation: none; }
/* 禅模式下光晕也跟着收敛，让环成为唯一光源 */
.glow { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; transition: opacity 0.8s ease; }
.screen.deep.zen .glow { opacity: 0.35; }
/*
 * 入场动画（二级页只在进入时挂载一次，从 0 淡入不会闪，这点和 tab 页不同）。
 * 节奏参考主流专注类 App 的"分层错峰"：
 *   语录先柔亮(0.15s 后) → 中央计时区轻缩浮现 → 底部操作区再上浮(0.12s 后)。
 * 全部只动 opacity / transform，合成器直出，真机不掉帧。
 */
.topbar .quote { animation: softFade 0.6s ease-out 0.15s both; }
.center { animation: zoneIn 0.5s cubic-bezier(0.22, 0.9, 0.3, 1) both; }
.bottom { animation: riseIn 0.5s cubic-bezier(0.22, 0.9, 0.3, 1) 0.12s both; }
@keyframes softFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoneIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes riseIn { from { opacity: 0; transform: translateY(16rpx); } to { opacity: 1; transform: none; } }

.topbar {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 18rpx 30rpx 0;
  .back { font-size: 40rpx; color: #fff; width: 60rpx; }
  .quote {
    flex: 1;
    text-align: center;
    padding: 0 40rpx;
    font-size: 24rpx;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
    max-height: 120rpx;
    overflow: hidden;
  }
  .bar-right { width: 60rpx; }
}
.center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  .ring {
    position: relative;
    width: 460rpx;
    height: 460rpx;
    border: 6rpx solid rgba(255, 255, 255, 0.16);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 60rpx rgba(255, 255, 255, 0.18);
    /* 不加 backdrop-filter：呼吸动画每帧缩放，模糊就得每帧重算（真机又卡又僵） */
    &.breathe { animation: breathe 5s ease-in-out infinite; }
    /* 暂停不让呼吸"戛然而止"，而是把动作冻结在当前姿态（主流冥想/专注 App 的做法），恢复时原地继续 */
    &.hold { animation-play-state: paused; }
    &.paused .ring-prog { opacity: 0.45; }
    .time { font-size: 108rpx; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 2rpx; text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.35); transition: opacity 0.3s ease; }
    .cap { margin-top: 6rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.85); transition: opacity 0.3s ease; }
    &.paused .time { opacity: 0.78; }
  }
  /* 进度弧：铺满整环，再用 mask 抠出与描边等宽的环带 */
  .ring-prog {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border-radius: 50%;
    pointer-events: none;
    transition: opacity 0.3s ease;
    -webkit-mask: radial-gradient(closest-side, transparent 95%, #000 96%);
    mask: radial-gradient(closest-side, transparent 95%, #000 96%);
  }
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 50rpx rgba(255, 255, 255, 0.16); transform: scale(1); }
  50% { box-shadow: 0 0 90rpx rgba(255, 255, 255, 0.34); transform: scale(1.015); }
}
.confetti { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
.cf {
  position: absolute;
  top: -60rpx;
  animation-name: fall;
  animation-timing-function: cubic-bezier(0.3, 0.6, 0.5, 1);
  animation-fill-mode: forwards;
}
/* 完成瞬间从计时环扩散出去的光环 */
.ring-pulse {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 460rpx;
  height: 460rpx;
  margin: -230rpx 0 0 -230rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.85);
  pointer-events: none;
  animation: ringPulse 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}
@keyframes ringPulse {
  0% { transform: scale(1); opacity: 0.9; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes fall {
  0% { transform: translateY(0) rotate(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(70vh) rotate(220deg); opacity: 0; }
}
/* 确认卡片 */
.pop-mask {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0;
  background: rgba(8, 6, 10, 0.55); z-index: 99;
  display: flex; align-items: center; justify-content: center; padding: 0 48rpx;
  animation: fadeIn 0.22s ease;
}
.pop-card {
  width: 100%; max-width: 600rpx;
  background: #fff; color: #333;
  border-radius: 30rpx; padding: 40rpx 34rpx 30rpx;
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  animation: popIn 0.3s cubic-bezier(0.34, 1.28, 0.64, 1);
  box-shadow: 0 24rpx 70rpx rgba(0, 0, 0, 0.3);
}
.cf-emoji { font-size: 76rpx; }
.cf-title { font-size: 34rpx; font-weight: 800; }
.cf-desc { font-size: 22rpx; color: #8a7c82; text-align: center; line-height: 1.7; }
.cf-actions { display: flex; gap: 18rpx; margin-top: 22rpx; width: 100%; }
.cf-btn {
  flex: 1; text-align: center; border-radius: 999rpx; padding: 20rpx 0; font-size: 27rpx; font-weight: 700;
  &.cancel { background: #f4eff1; color: #6b5c62; }
  &.ok { background: var(--p-primary, #e53935); color: #fff; }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { from { transform: scale(0.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx 30rpx calc(40rpx + env(safe-area-inset-bottom));
  .task-name { font-size: 40rpx; font-weight: 800; text-shadow: 0 3rpx 14rpx rgba(0, 0, 0, 0.3); }
  .status { font-size: 24rpx; color: rgba(255, 255, 255, 0.8); margin-top: 8rpx; }
  .controls { margin-top: 40rpx; display: flex; flex-direction: column; align-items: center; }
  /* 状态切换（待开始 ⇄ 进行中 ⇄ 暂停）时按钮组整体淡入上浮，
     v-if 换结构不可避免，但让"新的一组"柔和进场，而不是瞬间蹦出来 */
  .pill-main,
  .row {
    animation: riseIn 0.28s cubic-bezier(0.33, 1, 0.68, 1) both;
  }
  .pill-main {
    background: #fff;
    color: var(--p-deep, #1a2a6c);
    font-size: 32rpx;
    font-weight: 800;
    border-radius: 999rpx;
    padding: 20rpx 96rpx;
    box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
    &:active { transform: scale(0.96); }
  }
  .row { display: flex; gap: 48rpx; }
  .btn-sub {
    display: flex; flex-direction: column; align-items: center; gap: 8rpx; font-size: 22rpx; color: rgba(255,255,255,0.9);
    .e {
      width: 104rpx; height: 104rpx; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 42rpx;
      background: rgba(255, 255, 255, 0.16); border: 2rpx solid rgba(255, 255, 255, 0.35);
      transition: transform 0.15s ease, background 0.2s ease;
    }
    &:active .e { transform: scale(0.9); }
    &.strong .e { background: rgba(255, 255, 255, 0.9); color: var(--p-deep, #1a2a6c); border: none; }
    &.ghost .e { background: rgba(0, 0, 0, 0.28); border: none; }
  }
  .end-link { margin-top: 24rpx; font-size: 24rpx; color: rgba(255, 255, 255, 0.85); text-decoration: underline; }
}

/* 中央环 + 操作区的共同容器：竖屏时纵向排（环 flex:1 撑满中间），横屏时转横向居中 */
.landscape-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/*
 * 横屏（平板）：顶栏贴顶，下方一个横向容器居中"计时环 + 操作区"两栏。
 * 不能用 flex-wrap 两行 + align-items:center：align-content 默认 stretch 会把剩余高度
 * 平分给两行，顶栏行被撑到半屏高，返回键/语录就被垂直居中到屏幕中部（真机踩过）。
 * 竖着排时横屏高度（最小只有 390px）会把环和按钮挤在一起，环也放不下。
 */
.screen.is-landscape {
  flex-direction: column;
}
.screen.is-landscape .topbar { width: 100%; padding-bottom: 0; }
.screen.is-landscape .landscape-body {
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
/* 两栏按内容自适应宽度，中间留固定间距，整组居中 */
.screen.is-landscape .landscape-body .center { flex: 0 0 auto; }
.screen.is-landscape .landscape-body .bottom { flex: 0 0 auto; margin-left: 9%; margin-right: 4%; }
.screen.is-landscape .center .ring { width: 430rpx; height: 430rpx; }
.screen.is-landscape .center .ring .time { font-size: 100rpx; }
/* 平板宽屏下再放大一号，避免大屏上环显得小气 */
.screen.is-wide.is-landscape .center .ring { width: 500rpx; height: 500rpx; }
.screen.is-wide.is-landscape .center .ring .time { font-size: 116rpx; }
</style>
