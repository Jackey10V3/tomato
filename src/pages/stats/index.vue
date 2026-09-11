<script setup lang="ts">
/** 统计数据：与主界面统一风格（粉顶 + 渐变强调卡 + 彩色环形 + 药丸图例） */
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFocusStore, countsInStats } from '@/store/modules/focus'
import { useTaskStore } from '@/store/modules/task'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { useCountUp } from '@/composables/useCountUp'
import { useEnterAnim } from '@/composables/useEnterAnim'
import { usePageError } from '@/composables/usePageError'
import { themeStyle, posterBg, chartPalette, buildTodoColorMap } from '@/utils/theme'
import { mondayKey, parseDateKey } from '@/utils/date'
import PageError from '@/components/PageError.vue'
import type { FocusRecord } from '@/types/focus'

const store = useFocusStore()
const taskStore = useTaskStore()
const settings = useSettingsStore()
const { statusBarH } = useChrome()
const { layoutClass } = useResponsive()
const { animKey } = useEnterAnim()
/** 渲染出错时不再白屏（公共兜底，与待办 / 我的页一致） */
const { pageError, copyErr, dismiss: dismissErr } = usePageError('stats-page')
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))

type Period = 'day' | 'week' | 'month' | 'year'
const period = ref<Period>('week')
const PERIODS: { k: Period; label: string }[] = [
  { k: 'day', label: '今日' },
  { k: 'week', label: '本周' },
  { k: 'month', label: '本月' },
  { k: 'year', label: '今年' },
]

/**
 * 统计区间判定：统一用记录的 dateKey（含「午夜模式」归属）做区间比较，
 * 与 focus store 的当日/本周统计共用同一口径。
 * 原先用 startedAt 时间戳判定，跨零点时「当日专注」卡和饼图会给出互相矛盾的数字。
 */
function inPeriod(r: FocusRecord, p: Period): boolean {
  const tk = store.todayKey
  const key = r.dateKey || ''
  if (!key) return false
  if (p === 'day') return key === tk
  if (p === 'week') return key >= mondayKey(parseDateKey(tk)) && key <= tk
  if (p === 'month') return key.startsWith(tk.slice(0, 7))
  return key.startsWith(tk.slice(0, 4))
}

interface Slice {
  name: string
  /** 未取整的原始分钟：用于角度/占比/总计，避免逐项取整造成总和不一致 */
  raw: number
  minutes: number
  color: string
  /** 占比 0-1 */
  pct: number
  /** 扇形中点角度（自 12 点顺时针） */
  angle: number
}
/** 图表色板由主题主色派生，保证全站同一色系 */
const palette = computed(() => chartPalette(settings.themeDef.primary))
/** 与首页完全一致的待办配色表（自定义色优先，其余按创建顺序）；必须声明在 slices 之前，否则 App 端 setup 会 TDZ 报错 */
const colorMap = computed(() => buildTodoColorMap(taskStore.tasks, settings.themeDef.primary))

const slices = computed<Slice[]>(() => {
  const map = new Map<string, { name: string; minutes: number; color?: string; free?: boolean }>()
  store.records.forEach(r => {
    // 有效专注的判定复用 store 的 countsInStats，避免"两套口径"
    if (!countsInStats(r) || !inPeriod(r, period.value)) return
    const key = r.taskId || 'FREE'
    const cur = map.get(key) || { name: '', minutes: 0 }
    const task = r.taskId ? taskStore.byId(r.taskId) : undefined
    cur.name = key === 'FREE' ? '自由专注' : task?.title || r.taskTitle || '未命名任务'
    cur.minutes += r.actualSec / 60
    if (key === 'FREE') cur.free = true
    // 颜色优先级：待办自定义色 → 首页统一配色表 → 图表色板
    cur.color = (task?.color && task.color) || colorMap.value.get(key) || cur.color
    map.set(key, cur)
  })
  const raw = [...map.values()].sort((a, b) => b.minutes - a.minutes)
  const total = raw.reduce((a, b) => a + b.minutes, 0) || 1
  let acc = 0
  return raw.map((g, i) => {
    const pct = g.minutes / total
    const angle = (acc / total) * 360 + (pct * 360) / 2
    acc += g.minutes
    return {
        name: g.name,
        raw: g.minutes,
        minutes: Math.round(g.minutes),
      // 统计项颜色＝对应待办颜色（与首页一致）；「自由专注」用中性灰
      color: g.color || (g.free ? '#b8b2ac' : palette.value[i % palette.value.length]),
      pct,
      angle,
    }
  })
})

interface PieLabel {
  name: string
  minutes: number
  pct: number
  color: string
  side: 'left' | 'right'
  /** 标签文字锚点（rpx，相对舞台左上角） */
  lx: number
  ly: number
  /** 折线：径向段（扇形边缘 → 折点） */
  radial: { left: number; top: number; width: number; angle: number }
  /** 折线：竖向段（折点 → 标签所在高度） */
  vline: { left: number; top: number; height: number }
  /** 折线：横向段（折点 → 标签内侧） */
  hline: { top: number; left: number; width: number }
}
/** 舞台为正方形（560rpx），几何计算才不会因宽高比失真 */
const STAGE = 560
const CENTER = STAGE / 2
const PIE_R = 132
const ELBOW_R = 160
const LABEL_R = 172
const GAP = 36

/** 饼图外部标注：折线连接扇形与文字，长尾合并，分侧防重叠 */
const pieLabels = computed<PieLabel[]>(() => {
  const items = slices.value.filter(s => s.pct > 0)
  if (!items.length) return []
  const total = items.reduce((a, b) => a + b.raw, 0) || 1
  let shown = items.slice(0, 6)
  const rest = items.slice(6)
  if (rest.length) {
    const m = rest.reduce((a, b) => a + b.raw, 0)
    shown = [...shown, { name: '其他', raw: m, minutes: Math.round(m), color: '#b8b2ac', pct: m / total, angle: 0 }]
  }

  interface Temp {
    name: string
    minutes: number
    pct: number
    color: string
    side: 'left' | 'right'
    lx: number
    ly: number
    ex: number
    ey: number
    radial: { left: number; top: number; width: number; angle: number }
  }

  let acc = 0
  const temp: Temp[] = shown.map(s => {
    const pct = s.raw / total
    const midAngle = (acc / total) * 360 + (pct * 360) / 2
    acc += s.raw
    const rad = (midAngle * Math.PI) / 180
    const sin = Math.sin(rad)
    const cos = Math.cos(rad)
    // 折点 / 文字锚点（舞台为正方形，rpx 直算）
    const ex = CENTER + ELBOW_R * sin
    const ey = CENTER - ELBOW_R * cos
    const lx = CENTER + LABEL_R * sin
    const ly = CENTER - LABEL_R * cos
    // 径向短线：位于扇形边缘与折点之间，指向角度即该扇形中点角度
    const midR = (PIE_R + ELBOW_R) / 2
    const mx = CENTER + midR * sin
    const my = CENTER - midR * cos
    const radialLen = ELBOW_R - PIE_R
    const angleDeg = (Math.atan2(-cos, sin) * 180) / Math.PI
    return {
      name: s.name,
      minutes: s.minutes,
      pct,
      color: s.color,
      side: sin >= 0 ? 'right' : 'left',
      lx,
      ly,
      ex,
      ey,
      radial: { left: mx - radialLen / 2, top: my - 1, width: radialLen, angle: angleDeg },
    }
  })

  // 分侧防重叠：同侧纵向最小间距 GAP，并整体收敛到可视高度内
  ;(['left', 'right'] as const).forEach(side => {
    const arr = temp.filter(l => l.side === side).sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].ly - arr[i - 1].ly < GAP) arr[i].ly = arr[i - 1].ly + GAP
    }
    const overflow = arr.length ? arr[arr.length - 1].ly - (STAGE - 40) : 0
    if (overflow > 0) arr.forEach(l => (l.ly -= overflow))
    arr.forEach(l => (l.ly = Math.max(40, l.ly)))
  })

  return temp.map(l => ({
    name: l.name,
    minutes: l.minutes,
    pct: l.pct,
    color: l.color,
    side: l.side,
    lx: l.lx,
    ly: l.ly,
    radial: l.radial,
    vline: { left: l.ex - 1, top: Math.min(l.ey, l.ly), height: Math.abs(l.ly - l.ey) },
    hline: { top: l.ly - 1, left: Math.min(l.ex, l.lx), width: Math.abs(l.lx - l.ex) },
  }))
})
const totalMinutes = computed(() => slices.value.reduce((a, b) => a + b.raw, 0))

/* ---------- 饼图展开动画：扇形按 easeOutCubic 从 0 扫到整圈 ---------- */
const pieSweep = ref(1)
let sweepTimer: ReturnType<typeof setInterval> | null = null
function playPie() {
  if (sweepTimer) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
  const t0 = Date.now()
  pieSweep.value = 0
  sweepTimer = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / 700)
    pieSweep.value = 1 - Math.pow(1 - p, 3)
    if (p >= 1 && sweepTimer) {
      clearInterval(sweepTimer)
      sweepTimer = null
    }
  }, 16)
}
watch(period, () => playPie())
watch(totalMinutes, () => playPie())

const donut = computed(() => {
  if (totalMinutes.value <= 0) return ''
  const sweep = pieSweep.value
  let acc = 0
  const parts: string[] = []
  slices.value.forEach(s => {
    if (s.minutes <= 0) return
    const start = (acc / totalMinutes.value) * 360 * sweep
    acc += s.raw
    parts.push(`${s.color} ${start}deg ${(acc / totalMinutes.value) * 360 * sweep}deg`)
  })
  return `conic-gradient(${parts.join(', ')})`
})

function human(m: number): string {
  if (m <= 0) return '0 分钟'
  if (m < 60) return `${Math.round(m)} 分钟`
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return mm ? `${h} 小时 ${mm} 分钟` : `${h} 小时`
}

const today = computed(() => store.summary.today)
const todayDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const periodLabel = computed(() => {
  const tk = store.todayKey
  const d = parseDateKey(tk)
  if (period.value === 'day') return `${d.getMonth() + 1}月${d.getDate()}日`
  if (period.value === 'week') {
    const mon = parseDateKey(mondayKey(d))
    const end = new Date(mon.getTime() + 6 * 86400000)
    return `${mon.getMonth() + 1}/${mon.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
  }
  if (period.value === 'month') return `${d.getFullYear()}年${d.getMonth() + 1}月`
  return `${d.getFullYear()}年`
})
/** 当前周期内的完整统计：与饼图取同一批记录，保证「总计/完成率」和图形一致 */
const periodStat = computed(() => {
  let pomodoros = 0
  let minutes = 0
  let abandoned = 0
  let giveup = 0
  store.records.forEach(r => {
    if (r.kind !== 'focus' || !inPeriod(r, period.value)) return
    if (countsInStats(r)) {
      pomodoros += 1
      minutes += r.actualSec / 60
    } else if (r.result === 'abandoned') abandoned += 1
    else if (r.result === 'giveup') giveup += 1
  })
  const attempts = pomodoros + abandoned + giveup
  return {
    pomodoros,
    minutes: Math.round(minutes),
    abandoned,
    giveup,
    attempts,
    rate: attempts ? Math.round((pomodoros / attempts) * 100) : 0,
  }
})

/**
 * 日均分钟：分母用「有有效专注的天数」。
 * 原先分母统计了所有有记录的日期（包含只有 10 秒尝试的日子），日均被明显低估。
 */
const avgMinutes = computed(() => {
  const days = store.summary.activeDays
  return days ? Math.round(store.summary.totalFocusMinutes / days) : 0
})
const monthLabel = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})
const monthDist = computed(() => hourDist.value.reduce((a, b) => a + b, 0))
/** 本月按小时（0-23）的真实专注分钟分布（口径同上，按 dateKey 归属月份） */
const hourDist = computed(() => {
  const prefix = store.todayKey.slice(0, 7)
  const arr = new Array(24).fill(0) as number[]
  store.records.forEach(r => {
    if (!countsInStats(r) || !r.dateKey.startsWith(prefix)) return
    arr[new Date(r.startedAt).getHours()] += r.actualSec / 60
  })
  return arr.map(v => Math.round(v))
})

// ---------- 数字生长动效（统计数字不再"跳变"，而是滚动到位） ----------
const totalPomoView = useCountUp(() => store.summary.totalPomodoros)
const totalMinView = useCountUp(() => store.summary.totalFocusMinutes)
const avgView = useCountUp(() => avgMinutes.value)
const todayPomoView = useCountUp(() => today.value.pomodoros)
const todayMinView = useCountUp(() => today.value.focusMinutes)
const periodMinView = useCountUp(() => periodStat.value.minutes)
const rateView = useCountUp(() => periodStat.value.rate)
/** 数字动画的显示值：兼容 App 端模板不自动解包 ref 的情况 */
function shown(v: number | { value: number }): number {
  const n = typeof v === 'number' ? v : Number((v as { value: number })?.value)
  return Math.round(Number.isFinite(n) ? n : 0)
}
const maxHourVal = computed(() => Math.max(1, ...hourDist.value))
const peakHour = computed(() => hourDist.value.indexOf(Math.max(...hourDist.value)))
function barH(v: number): number {
  return 8 + (v / maxHourVal.value) * 120
}

function goTodo() {
  uni.navigateTo({ url: '/pages/stats/records' })
}
function goAch() {
  uni.navigateTo({ url: '/pages/mine/achievements' })
}
function goAppearance() {
  uni.navigateTo({ url: '/pages/mine/appearance' })
}
/**
 * 分享（复制文本报告到剪贴板）。
 * 关键修正：区分「本周期」与「累计」——原先报告里时长是本周期的、番茄数是累计的，两套数字混在一起。
 */
function shareReport() {
  const p = periodStat.value
  const detail = slices.value
    .map(s => `${s.name} ${human(s.minutes)}（${Math.round((s.minutes / Math.max(1, totalMinutes.value)) * 100)}%）`)
    .join('\n')
  const text = [
    `【番茄Todo 专注报告 · ${periodLabel.value}】`,
    `周期专注：${human(p.minutes)} · 有效 ${p.pomodoros} 次 · 完成率 ${p.rate}% · 放弃 ${p.giveup + p.abandoned} 次`,
    `累计：${store.summary.totalPomodoros} 次 / ${human(store.summary.totalFocusMinutes)} · 连续打卡 ${store.summary.streakDays} 天`,
    '',
    '任务分布：',
    detail || '暂无数据',
  ].join('\n')
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '报告已复制，可粘贴分享', icon: 'none' }),
  })
}

onShow(() => {
  taskStore.loadLocal()
  settings.applySideEffects()
  playPie()
})
</script>

<template>
  <view class="screen t-page" :class="layoutClass" :style="[style, { background: poster }]">
    <!-- 渲染异常时显示错误卡而不是白屏（公共组件，与待办/我的页一致） -->
    <PageError v-if="pageError" :message="pageError" @copy="copyErr" @dismiss="dismissErr" />

    <!-- 顶部（与首页同款：浅粉铺满 + 深色标题） -->
    <view class="t-hero" :style="{ paddingTop: statusBarH + 'px' }">
      <view class="t-hero-head">
      <view>
        <text class="t-hero-title">统计数据</text>
        <text class="t-hero-sub">记录每一次专注</text>
      </view>
      <view class="t-hero-icons">
        <text @click="goAch">🏆</text>
        <text @click="goAppearance">🎨</text>
        <text @click="period = 'week'">⋯</text>
      </view>
      </view>
    </view>

    <scroll-view scroll-y class="t-body">
      <view :key="animKey">
        <!-- 宽屏（.is-2col）下这里会变成两栏，见 App.vue 的 .t-flow -->
        <view class="t-flow">
        <!-- 累计专注（渐变强调卡） -->
        <view class="total-card fade-row">
          <view class="tc-head"><text class="tc-title">累计专注</text><text class="tc-ico">📈</text></view>
          <view class="tc-grid">
            <view class="tc"><text class="n">{{ shown(totalPomoView) }}</text><text class="c">次数</text></view>
            <view class="tc"><text class="n">{{ shown(totalMinView) }}</text><text class="c">总分钟</text></view>
            <view class="tc"><text class="n">{{ shown(avgView) }}</text><text class="c">日均分钟</text></view>
          </view>
        </view>

        <!-- 当日专注 -->
        <view class="t-card fade-row delay-1">
          <view class="row-head">
            <text class="t-section-title">当日专注</text>
            <text class="date">{{ todayDate }}</text>
            <text class="streak-chip">🔥 连续 {{ store.summary.streakDays }} 天</text>
          </view>
          <view class="hc-grid two">
            <view class="hc"><text class="n">{{ shown(todayPomoView) }}</text><text class="c">次数</text></view>
            <view class="hc"><text class="n">{{ human(todayMinView) }}</text><text class="c">时长</text></view>
          </view>
        </view>

        <!-- 完成情况（周期口径）：把"放弃"也如实计入，完成率才有意义 -->
        <view class="t-card fade-row delay-2">
          <view class="row-head">
            <text class="t-section-title">完成情况</text>
            <text class="date">{{ periodLabel }}</text>
            <text class="rate-num">{{ shown(rateView) }}%</text>
          </view>
          <view class="rate-bar"><view class="rate-fill" :style="{ width: shown(rateView) + '%' }" /></view>
          <view class="hc-grid">
            <view class="hc"><text class="n sm">{{ periodStat.pomodoros }}</text><text class="c">有效专注</text></view>
            <view class="hc"><text class="n sm">{{ periodStat.giveup }}</text><text class="c">主动放弃</text></view>
            <view class="hc"><text class="n sm">{{ periodStat.abandoned }}</text><text class="c">离席作废</text></view>
          </view>
        </view>

        <!-- 专注时长分布 -->
        <view class="t-card fade-row delay-3">
          <view class="row-head">
            <text class="t-section-title">专注时长分布</text>
            <text class="date">{{ periodLabel }}</text>
            <view class="nav"><text @click="shareReport">分享</text></view>
          </view>

          <view class="period-seg">
            <view v-for="p in PERIODS" :key="p.k" class="seg press" :class="{ on: period === p.k }" @click="period = p.k">{{ p.label }}</view>
          </view>

          <view v-if="totalMinutes > 0" class="pie-wrap">
            <!-- :key 绑定周期：切换日/周/月/年时重播入场动画 -->
            <view :key="period" class="pie-stage pie-in" :class="{ ready: pieSweep >= 1 }">
              <view class="pie" :style="{ background: donut }" />
              <template v-for="l in pieLabels" :key="l.name">
                <!-- 径向短线（贴扇形边缘） -->
                <view
                  class="pline"
                  :style="{
                    left: l.radial.left + 'rpx',
                    top: l.radial.top + 'rpx',
                    width: l.radial.width + 'rpx',
                    background: l.color,
                    transform: `rotate(${l.radial.angle}deg)`,
                  }"
                />
                <!-- 折角竖线 -->
                <view
                  class="pline"
                  :style="{ left: l.vline.left + 'rpx', top: l.vline.top + 'rpx', height: l.vline.height + 'rpx', width: '2rpx', background: l.color }"
                />
                <!-- 水平引线 -->
                <view
                  class="pline"
                  :style="{ left: l.hline.left + 'rpx', top: l.hline.top + 'rpx', width: l.hline.width + 'rpx', height: '2rpx', background: l.color }"
                />
                <!-- 文字标注 -->
                <view class="pl" :class="l.side" :style="{ left: l.lx + 'rpx', top: l.ly + 'rpx' }">
                  <text class="pl-name">{{ l.name }}</text>
                  <text class="pl-time">{{ human(l.minutes) }} · {{ Math.round(l.pct * 100) }}%</text>
                </view>
              </template>
            </view>
            <text class="total-line">总计 {{ human(totalMinutes) }} · 有效 {{ periodStat.pomodoros }} 次</text>
            <view class="btn-main press" @click="goTodo">查看专注记录</view>
          </view>
          <view v-else class="empty">
            <text class="emoji">📊</text>
            <text>该周期还没有专注时长</text>
            <text class="sub">完成一次 ≥3 分钟的专注后，这里会出现分布图</text>
          </view>
        </view>

        <!-- 本月专注时段分布（真实按小时统计） -->
        <view class="t-card fade-row delay-4">
          <view class="row-head">
            <text class="t-section-title">本月专注时段分布</text>
            <text class="date">{{ monthLabel }}</text>
          </view>
          <view class="hour-head">
            <text class="big-num">{{ monthDist }} 分钟</text>
            <text v-if="monthDist > 0" class="peak">最专注 {{ peakHour }}:00</text>
          </view>
          <view class="hour-bars">
            <view
              v-for="(v, i) in hourDist"
              :key="i"
              class="hb"
              :class="{ peak: v === maxHourVal && v > 0 }"
              :style="{ height: barH(v) + 'rpx', animationDelay: i * 22 + 'ms' }"
            />
          </view>
          <view class="axis"><text>0</text><text>6</text><text>12</text><text>18</text><text>23 时</text></view>
        </view>
        </view>

        <text class="stat-note">* 单次专注低于 3 分钟不计入统计（仍保留在专注记录里）</text>
        <view class="t-bottom-space" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.total-card {
  margin: 18rpx 24rpx;
  border-radius: 28rpx;
  padding: 26rpx;
  color: #fff;
  background: linear-gradient(135deg, var(--p-light, #f4708b), var(--p-primary, #e2475f));
  box-shadow: 0 12rpx 30rpx rgba(216, 65, 93, 0.22);
  .tc-head { display: flex; justify-content: space-between; align-items: center; }
  .tc-title { font-size: 30rpx; font-weight: 800; }
  .tc-ico { font-size: 30rpx; }
  .tc-grid { display: flex; margin-top: 24rpx; }
  .tc { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
  .n { font-size: 52rpx; font-weight: 900; }
  .c { font-size: 22rpx; opacity: 0.9; }
}
.row-head { display: flex; align-items: center; gap: 14rpx; }
.date { font-size: 22rpx; color: var(--p-sub, #b39aa1); flex: 1; }
.nav { display: flex; gap: 20rpx; color: var(--p-primary, #e2475f); font-size: 26rpx; }
.hc-grid { display: flex; margin-top: 20rpx; }
.hc-grid.two { max-width: 74%; }
.hc { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.hc .n { font-size: 40rpx; font-weight: 800; color: var(--p-primary, #e2475f); }
.hc .n.sm { font-size: 34rpx; }
.hc .c { font-size: 22rpx; color: var(--p-sub, #b39aa1); }

/* ---- 入场错峰：卡片自上而下依次浮现，而不是整页同时闪一下 ---- */
.delay-1 { animation-delay: 60ms; }
.delay-2 { animation-delay: 120ms; }
.delay-3 { animation-delay: 180ms; }
.delay-4 { animation-delay: 240ms; }

/* ---- 连续打卡 / 完成率 ---- */
.streak-chip {
  font-size: 22rpx;
  color: var(--p-primary, #e2475f);
  background: var(--p-soft, #fdecf0);
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
  flex-shrink: 0;
}
.rate-num { font-size: 32rpx; font-weight: 800; color: var(--p-primary, #e2475f); }
.rate-bar {
  height: 14rpx;
  border-radius: 999rpx;
  background: var(--p-soft, #fdecf0);
  margin-top: 18rpx;
  overflow: hidden;
}
.rate-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--p-grad, linear-gradient(90deg, #f79db0, #e2475f));
  transition: width 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
}

/* ---- 饼图入场：从中心展开并轻微回正 ---- */
.pie-in { animation: pieIn 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.05) both; }
@keyframes pieIn {
  from { opacity: 0; transform: scale(0.82) rotate(-8deg); }
  to { opacity: 1; transform: none; }
}

/* ---- 饼图展开动画：引线与标注等扇形扫完再淡入 ---- */
.pie-stage .pline,
.pie-stage .pl { opacity: 0; transition: opacity 0.35s ease; }
.pie-stage.ready .pline,
.pie-stage.ready .pl { opacity: 1; }

/* ---- 柱状图逐根生长（只动 transform，避免覆盖 .peak 的透明度） ---- */
.hb { transform-origin: bottom center; animation: barGrow 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
@keyframes barGrow {
  from { transform: scaleY(0.04); }
  to { transform: scaleY(1); }
}
.period-seg { display: flex; margin-top: 20rpx; background: var(--p-soft, #fdecf0); border-radius: 999rpx; padding: 5rpx; }
.seg { flex: 1; text-align: center; padding: 10rpx 0; border-radius: 999rpx; font-size: 24rpx; color: var(--p-sub, #c99aa6); &.on { background: var(--p-card, #fff); color: var(--p-primary, #e2475f); font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06); } }
.pie-wrap { display: flex; flex-direction: column; align-items: center; margin-top: 16rpx; }
/* 饼图舞台：正方形（560rpx），标注位置按 rpx 几何计算，折线引出 */
.pie-stage {
  position: relative;
  width: 560rpx;
  height: 560rpx;
  margin: 0 auto;
}
.pie {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 264rpx;
  height: 264rpx;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 10rpx 26rpx rgba(0, 0, 0, 0.1);
}
.pline { position: absolute; border-radius: 2rpx; }
.pl {
  position: absolute;
  display: flex;
  flex-direction: column;
  max-width: 150rpx;
  &.right {
    transform: translate(10rpx, -50%);
    align-items: flex-start;
  }
  &.left {
    transform: translate(calc(-100% - 10rpx), -50%);
    align-items: flex-end;
    text-align: right;
  }
}
.pl-name {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--p-text, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150rpx;
}
.pl-time { font-size: 22rpx; color: var(--p-sub, #999); white-space: nowrap; }
.total-line { margin-top: 18rpx; font-size: 26rpx; color: #e2475f; font-weight: 700; }
.chips { width: 100%; margin-top: 22rpx; display: flex; flex-direction: column; gap: 12rpx; }
.chip-row {
  display: flex; align-items: center; gap: 14rpx;
  background: var(--p-soft, #fdf3f5); border-radius: 18rpx; padding: 16rpx 20rpx;
  .dot { width: 20rpx; height: 20rpx; border-radius: 50%; }
  .chip-name { flex: 1; font-size: 26rpx; }
  .chip-val { font-size: 24rpx; color: var(--p-primary, #e2475f); font-weight: 700; }
  .chip-pct { width: 76rpx; text-align: right; font-size: 22rpx; color: var(--p-sub, #b39aa1); }
}
.btn-main {
  margin-top: 24rpx;
  background: linear-gradient(135deg, var(--p-light, #f4708b), var(--p-primary, #e2475f));
  color: #fff; font-size: 28rpx; font-weight: 700;
  border-radius: 999rpx; padding: 18rpx 68rpx;
  box-shadow: 0 10rpx 24rpx rgba(216, 65, 93, 0.22);
}
.empty { display: flex; flex-direction: column; align-items: center; gap: 10rpx; padding: 40rpx 0; color: #b39aa1; font-size: 24rpx; .emoji { font-size: 70rpx; } .sub { font-size: 22rpx; color: #c9bfc4; } }
.big-num { display: block; margin-top: 10rpx; font-size: 44rpx; font-weight: 800; color: var(--p-primary, #e2475f); }
.hour-head { display: flex; align-items: baseline; gap: 16rpx; }
.peak { font-size: 22rpx; color: var(--p-sub, #b39aa1); }
.hour-bars { display: flex; gap: 6rpx; align-items: flex-end; height: 150rpx; margin-top: 14rpx; }
.hb {
  flex: 1; border-radius: 6rpx 6rpx 3rpx 3rpx;
  background: var(--p-grad, linear-gradient(180deg, #f79db0, #e2475f));
  opacity: 0.75;
  &.peak { opacity: 1; background: var(--p-primary, #e2475f); box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.12); }
}
.axis { display: flex; justify-content: space-between; margin-top: 8rpx; font-size: 22rpx; color: var(--p-sub, #b39aa1); }
.stat-note { display: block; text-align: center; margin: 14rpx 0 10rpx; font-size: 22rpx; color: var(--p-sub, #bbb); }
</style>
