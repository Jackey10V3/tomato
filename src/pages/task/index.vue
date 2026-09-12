<script setup lang="ts">
/**
 * 待办首页（番茄ToDo 风格）：顶部「待办 + 点击开启学霸模式 + ＋/⋯」，
 * 多彩渐变卡片列表，每卡含名称/时长/今日已专注 N 次/右侧「开始」；点卡进入二级计时，长按编辑。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { useTaskStore } from '@/store/modules/task'
import { useFocusStore, MIN_STAT_SEC } from '@/store/modules/focus'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { useEnterAnim } from '@/composables/useEnterAnim'
import { usePageError } from '@/composables/usePageError'
import { useNativeTabBar } from '@/composables/useNativeTabBar'
import PageError from '@/components/PageError.vue'
import TabDock from '@/components/TabDock.vue'
import { themeStyle, posterBg, todoPalette, buildTodoColorMap, colorGradient, hashStr, pickerPalette, normalizeHex } from '@/utils/theme'
import { useCanvasBg } from '@/composables/useCanvasBg'
import { PRIORITY_META, PRIORITY_OPTIONS } from '@/utils/constant'
import TagSelect from '@/components/TagSelect.vue'
import { storage } from '@/utils/storage'
import type { Task, Priority } from '@/types/task'

const store = useTaskStore()
const focusStore = useFocusStore()
const settings = useSettingsStore()
const { statusBarH } = useChrome()
const { layoutClass } = useResponsive()
// 每次切回本页都重播卡片入场动画（原来只在首次进入时播一次）
const { animKey } = useEnterAnim()
/** 渲染出错时显示错误卡而不是白屏 */
const { pageError, copyErr, dismiss: dismissErr } = usePageError('task-page')
/** 入场动画只作用于前若干张卡片：条目多时同时播一堆动画会拖慢切页 */
const ENTER_MAX = 10
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))

const todos = computed(() =>
  [...store.tasks].filter(t => !t.deleted && !t.completed).sort((a, b) => b.createdAt - a.createdAt),
)

/**
 * 今日每个待办的专注次数：一次遍历预聚合，供模板查表。
 * 原实现每张卡片在模板里调用两次 todayCount()（v-if + 插值），
 * 每次都全量 filter 记录，卡片多 + 记录多时首页明显卡顿。
 * 「今天」的判定改用 store.todayKey（含午夜模式），与统计页口径一致。
 */
const todayCountMap = computed<Record<string, number>>(() => {
  const today = focusStore.todayKey
  const map: Record<string, number> = {}
  for (const r of focusStore.records) {
    if (r.kind !== 'focus' || !r.taskId) continue
    if (r.dateKey !== today || r.actualSec < MIN_STAT_SEC) continue
    if (r.result !== 'completed' && r.result !== 'manual') continue
    map[r.taskId] = (map[r.taskId] || 0) + 1
  }
  return map
})
/** 每个待办一个专属颜色：优先自定义色；「自动」按创建顺序取统一配色表 */
const palette = computed(() => todoPalette(settings.themeDef.primary))
const autoColorMap = computed(() => buildTodoColorMap(store.tasks, settings.themeDef.primary))
function colorOf(t: Task): string {
  if (t.color) return t.color
  return autoColorMap.value.get(t._id) || palette.value[hashStr(t._id) % palette.value.length]
}
function gradOf(t: Task): string {
  // 0.86 的透明度 + .todo 上的背景模糊 = 毛玻璃卡片；
  // 数值不能再低：白字压在虚化背景上会发虚（深色主题下更明显）
  return colorGradient(colorOf(t), 0.86)
}

// 考研倒计时卡片（天/时/分实时刷新，长按可编辑名称与时间）
const nowTick = ref(Date.now())
const examEdit = ref(false)
const examForm = reactive({ name: '', date: '', time: '' })
const examTarget = computed(() => new Date(`${settings.s.examDate}T${(settings.s.examTime || '00:00')}:00`))
const examLeft = computed(() => Math.max(0, examTarget.value.getTime() - nowTick.value))
const examDays = computed(() => Math.floor(examLeft.value / 86400000))
const examHours = computed(() => Math.floor((examLeft.value % 86400000) / 3600000))
const examMins = computed(() => Math.floor((examLeft.value % 3600000) / 60000))

function openExamEdit() {
  examForm.name = settings.s.examName || '考研'
  examForm.date = settings.s.examDate
  examForm.time = settings.s.examTime || '08:30'
  examEdit.value = true
}
function saveExam() {
  settings.update({ examName: examForm.name.trim() || '考研', examDate: examForm.date, examTime: examForm.time })
  examEdit.value = false
  uni.showToast({ title: '已更新', icon: 'success' })
}
function onExamDate(e: { detail: { value: string } }) {
  examForm.date = e.detail.value
}
function onExamTime(e: { detail: { value: string } }) {
  examForm.time = e.detail.value
}

// 今日概览
const todayStat = computed(() => focusStore.summary.today)
const streak = computed(() => focusStore.summary.streakDays)

// 今日番茄目标：完成度 0-100（超过 100 封顶显示，努力不封顶）
const goalPct = computed(() => {
  const goal = settings.s.dailyGoal
  if (!goal || goal <= 0) return 0
  return Math.min(100, Math.round((todayStat.value.pomodoros / goal) * 100))
})
/** 点目标胶囊改每日目标（0-99 之间的整数，0 表示不设目标） */
function editGoal() {
  uni.showModal({
    title: '每日番茄目标',
    content: String(settings.s.dailyGoal || 8),
    editable: true,
    placeholderText: '输入 0~99，0 为不设目标',
    success: r => {
      if (!r.confirm) return
      const n = Math.max(0, Math.min(99, Math.round(Number(r.content))))
      if (Number.isFinite(n)) settings.update({ dailyGoal: n })
    },
  })
}

// 背景海报
const poster = computed(() => posterBg(settings.s.poster))
// 沉浸式：把 html 画布刷成页面同款背景，盖住小白条区域的系统底色
useCanvasBg(() => poster.value)
// 等级
const level = computed(() => focusStore.levelInfo)
function goAch() {
  uni.navigateTo({ url: '/pages/mine/achievements' })
}

// ---------- 添加 / 编辑卡片 ----------
const showCard = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  title: '',
  mode: 'countdown' as 'countdown' | 'countup',
  minutePick: '30' as '30' | '60' | 'custom',
  customMin: '',
  color: '',
  priority: 2 as Priority,
  tags: [] as string[],
})
const minuteOptions = [
  { v: '30', label: '30 分钟' },
  { v: '60', label: '60 分钟' },
  { v: 'custom', label: '自定义' },
] as const

// ---------- 卡片颜色自选 ----------
/** 展开的完整色板（42 色，按色相 × 明度排列） */
const picker = pickerPalette()
const showMoreColors = ref(false)
const customColor = ref('')
/** 实时预览：合法就用输入值，非法就沿用当前选中色 */
const customPreview = computed(() => normalizeHex(customColor.value) || form.color || 'transparent')

function applyCustomColor() {
  const hex = normalizeHex(customColor.value)
  if (!hex) {
    uni.showToast({ title: '请输入如 #FF6B6B 的色值', icon: 'none' })
    return
  }
  form.color = hex
  customColor.value = hex
  uni.showToast({ title: '已应用自定义颜色', icon: 'none' })
}
/** 快捷：取色板上任意一色作为当前色 */
function pickColor(c: string) {
  form.color = c
  customColor.value = c
}

// ---------- 优先级 / 标签 ----------
/** 可选标签 = 全库已有标签 ∪ 当前正在编辑的标签（保证老标签不会丢） */
const tagOptions = computed(() => [...new Set<string>([...store.tags, ...form.tags])])
const newTag = ref('')
function addTag() {
  const t = newTag.value.trim().replace(/^#/, '').slice(0, 8)
  if (!t) return
  if (!form.tags.includes(t)) {
    if (form.tags.length >= 3) {
      uni.showToast({ title: '最多 3 个标签', icon: 'none' })
      return
    }
    form.tags.push(t)
  }
  newTag.value = ''
}

function openAdd() {
  editingId.value = null
  form.title = ''
  form.mode = 'countdown'
  form.minutePick = '30'
  form.customMin = ''
  form.color = ''
  form.priority = 2
  form.tags = []
  newTag.value = ''
  showCard.value = true
}
function openEdit(t: Task) {
  editingId.value = t._id
  form.title = t.title
  form.mode = t.mode
  form.minutePick = t.mode === 'countup' ? '30' : t.minutes === 60 ? '60' : 'custom'
  form.customMin = String(t.minutes > 0 && t.minutes !== 60 ? t.minutes : '')
  form.color = t.color || ''
  form.priority = t.priority ?? 2
  form.tags = [...(t.tags || [])]
  newTag.value = ''
  showCard.value = true
}
function closeCard() {
  showCard.value = false
}
function resolveMinutes(): number {
  if (form.minutePick === 'custom') {
    const n = Number(form.customMin)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }
  return form.minutePick === '60' ? 60 : 30
}
function save() {
  const title = form.title.trim()
  if (!title) {
    uni.showToast({ title: '请填写待办名称', icon: 'none' })
    return
  }
  const mode = form.mode
  let minutes = 25
  if (mode === 'countdown') {
    minutes = resolveMinutes()
    if (!minutes) {
      uni.showToast({ title: '请输入有效的自定义分钟数', icon: 'none' })
      return
    }
  }
  if (editingId.value) {
    store.update(editingId.value, { title, mode, minutes, color: form.color || undefined, priority: form.priority, tags: [...form.tags] })
    uni.showToast({ title: '已保存', icon: 'success' })
  } else {
    store.addToList('today', { title, mode, minutes, color: form.color || undefined, priority: form.priority, tags: [...form.tags] })
    uni.showToast({ title: '已添加待办', icon: 'success' })
  }
  showCard.value = false
}
function askDelete() {
  if (!editingId.value) return
  const t = store.byId(editingId.value)
  uni.showModal({
    title: '删除待办',
    content: t ? `确定删除「${t.title}」？` : '确定删除该待办？',
    confirmColor: '#e53935',
    success: r => {
      if (r.confirm && editingId.value) {
        store.remove(editingId.value)
        uni.showToast({ title: '已删除', icon: 'none' })
        showCard.value = false
      }
    },
  })
}

function openTimer(t: Task) {
  uni.navigateTo({ url: `/pages/timer/detail?id=${t._id}` })
}

/* ---------- 长按编辑：手指按住 550ms 且几乎不移动才触发，滑动浏览不会误触 ---------- */
const pressedId = ref('')
let pressTimer: ReturnType<typeof setTimeout> | null = null
let longFired = false
let startX = 0
let startY = 0

function onPressStart(t: Task, e: { touches?: ArrayLike<{ clientX: number; clientY: number }> }) {
  const p = e.touches?.[0]
  startX = p?.clientX ?? 0
  startY = p?.clientY ?? 0
  longFired = false
  pressedId.value = t._id
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    pressTimer = null
    longFired = true
    uni.vibrateShort()
    openEdit(t) // 打开编辑卡片；卡片自带 popIn 弹出动画
    setTimeout(() => (pressedId.value = ''), 280)
  }, 550)
}
function onPressMove(e: { touches?: ArrayLike<{ clientX: number; clientY: number }> }) {
  if (!pressTimer) return
  const p = e.touches?.[0]
  if (!p) return
  // 位移超过 12px 视为滑动（滚动列表），取消长按
  if (Math.abs(p.clientX - startX) > 12 || Math.abs(p.clientY - startY) > 12) {
    clearTimeout(pressTimer)
    pressTimer = null
    pressedId.value = ''
  }
}
function onPressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  pressedId.value = ''
  setTimeout(() => (longFired = false), 320)
}
function onCardTap(t: Task) {
  if (longFired) return // 长按刚触发过，忽略这次点击
  openTimer(t)
}
function goGuards() {
  uni.navigateTo({ url: '/pages/mine/guards' })
}
function moreMenu() {
  uni.showActionSheet({
    itemList: ['强力专注模式', '外观与音效', '计时设置'],
    success: r => {
      const map = ['/pages/mine/guards', '/pages/mine/appearance', '/pages/mine/settings']
      uni.navigateTo({ url: map[r.tapIndex] || map[0] })
    },
  })
}

// 首次使用引导
const guide = ref(false)
function closeGuide() {
  storage.set('guide:done', '1')
  guide.value = false
}
let tickTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!store.loaded) store.loadLocal()
  settings.applySideEffects()
  if (!storage.get<string>('guide:done')) guide.value = true
  // 倒计时分钟级刷新
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 20000)
})
onUnload(() => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})
useNativeTabBar()
onShow(() => {
  settings.applySideEffects()
  nowTick.value = Date.now()
  if (!store.loaded) store.loadLocal()
  if (store.tasks.length === 0) {
    uni.showModal({
      title: '导入示例待办？',
      content: '添加一组示例待办，方便直接体验计时与统计？',
      confirmText: '导入',
      cancelText: '先不用',
      success: r => r.confirm && store.seedDemo(),
    })
  }
})
</script>

<template>
  <view class="screen t-page" :class="layoutClass" :style="[style, { background: poster }]">
    <!-- 顶部（铺满到最上，状态栏区域也计入渐变） -->
    <view class="t-hero" :style="{ paddingTop: statusBarH + 'px' }">
      <view class="t-hero-head">
        <view class="tb-left">
          <text class="t-hero-title">待办</text>
          <view class="chip-row">
            <view class="study-pill" @click="goGuards">点击开启学霸模式</view>
            <view class="lv-pill" @click="goAch">Lv.{{ level.level }} · {{ level.title }}</view>
            <view v-if="settings.s.dailyGoal > 0" class="goal-pill" @click="editGoal">
              <text class="goal-txt">🍅 今日 {{ todayStat.pomodoros }}/{{ settings.s.dailyGoal }}</text>
              <view class="goal-bar">
                <view class="goal-fill" :style="{ width: goalPct + '%' }" />
              </view>
            </view>
          </view>
        </view>
        <view class="t-hero-icons">
          <text class="tb-icon" @click="goGuards">🎓</text>
          <view class="plus-btn" @click="openAdd"><text class="plus">＋</text></view>
          <text class="tb-icon dots" @click="moreMenu">⋯</text>
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <scroll-view scroll-y class="t-body">
      <view :key="animKey">
        <PageError v-if="pageError" :message="pageError" @copy="copyErr" @dismiss="dismissErr" />
        <!-- 考研倒计时卡片（长按编辑名称与时间） -->
        <view class="exam-card fade-row" @click="openExamEdit" @longpress="openExamEdit">
          <view class="exam-in">
            <view class="exam-left">
              <text class="exam-title">🎓 {{ settings.s.examName || '考研' }}倒计时</text>
              <text class="exam-date">{{ settings.s.examDate }} {{ settings.s.examTime }} · 点按/长按编辑</text>
            </view>
            <view class="exam-right">
              <view class="er-item"><text class="er-n">{{ examDays }}</text><text class="er-u">天</text></view>
              <view class="er-item"><text class="er-n">{{ examHours }}</text><text class="er-u">时</text></view>
              <view class="er-item"><text class="er-n">{{ examMins }}</text><text class="er-u">分</text></view>
            </view>
          </view>
        </view>

        <!-- 今日概览 -->
        <view class="ov-strip fade-row">
          <view class="ov"><text class="ov-n">{{ todayStat.pomodoros }}</text><text class="ov-c">今日番茄</text></view>
          <view class="ov"><text class="ov-n">{{ todayStat.focusMinutes }}</text><text class="ov-c">专注分钟</text></view>
          <view class="ov"><text class="ov-n">{{ streak }}</text><text class="ov-c">连续天数</text></view>
        </view>

        <view class="list">
          <view
            v-for="(t, i) in todos"
            :key="t._id"
            :class="['todo', 'fade-row', 'press', { popping: pressedId === t._id, 'no-enter': i >= ENTER_MAX }]"
            :style="{ background: gradOf(t), animationDelay: Math.min(i * 30, 260) + 'ms' }"
            @click="onCardTap(t)"
            @touchstart="onPressStart(t, $event)"
            @touchmove="onPressMove"
            @touchend="onPressEnd"
            @touchcancel="onPressEnd"
          >
            <view class="t-main">
              <text class="t-title">{{ t.title }}</text>
              <!-- 元信息行：时长 + 优先级（只标出高/低，默认"中"不显示以免噪音）+ 标签 -->
              <view class="t-meta">
                <text class="t-min">{{ t.mode === 'countdown' ? `${t.minutes} 分钟` : '正向计时' }}</text>
                <text v-if="t.priority === 3" class="t-pri high">高</text>
                <text v-else-if="t.priority === 1" class="t-pri low">低</text>
                <text v-for="tag in t.tags.slice(0, 2)" :key="tag" class="t-tag">#{{ tag }}</text>
              </view>
              <text v-if="todayCountMap[t._id]" class="t-times">今日已专注 {{ todayCountMap[t._id] }} 次</text>
            </view>
            <view class="t-start" @click.stop="openTimer(t)">开始</view>
          </view>
        </view>

        <view v-if="!todos.length" class="empty">
          <text class="emoji">🗒️</text>
          <text class="empty-t">还没有待办</text>
          <text class="sub">点击右上角 ＋ 添加，或长按待办可编辑 / 删除</text>
          <view class="pill add-first" @click="openAdd"><text>＋ 添加第一个待办</text></view>
        </view>
        <view class="t-bottom-space" />
      </view>
    </scroll-view>

    <!-- 添加 / 编辑卡片 -->
    <view v-if="showCard" class="pop-mask" @click="closeCard">
      <view class="pop-card" @click.stop>
        <view class="card-head">
          <text class="card-title">{{ editingId ? '编辑待办' : '添加待办' }}</text>
          <text class="card-close" @click="closeCard">✕</text>
        </view>

        <input v-model="form.title" class="name-input" placeholder="待办名称…" :placeholder-style="'color:#c9c2bc'" focus />

        <text class="sec-label">计时方式</text>
        <view class="mode-seg">
          <view class="seg" :class="{ on: form.mode === 'countdown' }" @click="form.mode = 'countdown'">倒计时</view>
          <view class="seg" :class="{ on: form.mode === 'countup' }" @click="form.mode = 'countup'">正向计时</view>
        </view>

        <template v-if="form.mode === 'countdown'">
          <text class="sec-label">时长</text>
          <view class="min-chips">
            <view v-for="opt in minuteOptions" :key="opt.v" class="min-chip" :class="{ on: form.minutePick === opt.v }" @click="form.minutePick = opt.v">
              {{ opt.label }}
            </view>
          </view>
          <input v-if="form.minutePick === 'custom'" v-model="form.customMin" class="custom-min" type="number" placeholder="自定义分钟数，如 45" :placeholder-style="'color:#c9c2bc'" />
        </template>

        <text class="sec-label">优先级</text>
        <view class="pri-row">
          <view
            v-for="p in PRIORITY_OPTIONS"
            :key="p"
            class="pri-chip"
            :class="{ on: form.priority === p }"
            :style="form.priority === p ? { borderColor: PRIORITY_META[p].color, color: PRIORITY_META[p].color } : {}"
            @click="form.priority = p"
          >
            {{ p === 0 ? '无' : PRIORITY_META[p].label }}
          </view>
        </view>

        <text class="sec-label">标签（最多 3 个）</text>
        <TagSelect v-if="tagOptions.length" v-model="form.tags" :options="tagOptions" :max="3" />
        <view class="tag-add">
          <input v-model="newTag" class="tag-input" placeholder="新标签，如 考研" :placeholder-style="'color:#c9c2bc'" @confirm="addTag" />
          <view class="tag-btn" @click="addTag">添加</view>
        </view>

        <text class="sec-label">卡片颜色</text>
        <view class="color-row">
          <view class="sw-auto" :class="{ on: !form.color }" @click="form.color = ''">自动</view>
          <view
            v-for="c in palette"
            :key="c"
            class="sw"
            :class="{ on: form.color === c }"
            :style="{ background: c }"
            @click="pickColor(c)"
          />
          <view class="sw-more" :class="{ on: showMoreColors }" @click="showMoreColors = !showMoreColors">
            {{ showMoreColors ? '收起' : '更多' }}
          </view>
        </view>

        <!-- 更多颜色：完整色板 + 自己输入色值 -->
        <view v-if="showMoreColors" class="color-more">
          <view class="cm-grid">
            <view
              v-for="c in picker"
              :key="c"
              class="sw sm"
              :class="{ on: form.color === c }"
              :style="{ background: c }"
              @click="pickColor(c)"
            />
          </view>
          <view class="cm-custom">
            <view class="cm-preview" :style="{ background: customPreview }" />
            <input
              v-model="customColor"
              class="cm-input"
              placeholder="#FF6B6B 或 FF6B6B"
              :placeholder-style="'color:#c9c2bc'"
              @confirm="applyCustomColor"
            />
            <view class="cm-apply" @click="applyCustomColor">应用</view>
          </view>
          <text class="cm-tip">当前：{{ form.color || '自动配色（按创建顺序从主题色系取色）' }}</text>
        </view>

        <view class="card-actions">
          <view v-if="editingId" class="btn-danger" @click="askDelete">删除</view>
          <view class="btn-space" />
          <view class="btn-cancel" @click="closeCard">取消</view>
          <view class="btn-save" @click="save">{{ editingId ? '保存' : '添加' }}</view>
        </view>
      </view>
    </view>

    <!-- 考研倒计时编辑卡片 -->
    <view v-if="examEdit" class="pop-mask" @click="examEdit = false">
      <view class="pop-card" @click.stop>
        <view class="card-head">
          <text class="card-title">编辑倒计时</text>
          <text class="card-close" @click="examEdit = false">✕</text>
        </view>

        <text class="sec-label">名称</text>
        <input v-model="examForm.name" class="name-input" placeholder="如：考研 / 高考 / 期末考试" :placeholder-style="'color:#c9c2bc'" />

        <text class="sec-label">目标日期</text>
        <picker mode="date" :value="examForm.date" @change="onExamDate">
          <view class="pick-row"><text>{{ examForm.date }}</text><text class="chev">›</text></view>
        </picker>

        <text class="sec-label">目标时间</text>
        <picker mode="time" :value="examForm.time" @change="onExamTime">
          <view class="pick-row"><text>{{ examForm.time }}</text><text class="chev">›</text></view>
        </picker>

        <view class="card-actions">
          <view class="btn-space" />
          <view class="btn-cancel" @click="examEdit = false">取消</view>
          <view class="btn-save" @click="saveExam">保存</view>
        </view>
      </view>
    </view>

    <!-- 首次使用引导 -->
    <view v-if="guide" class="pop-mask">
      <view class="pop-card guide" @click.stop>
        <text class="g-title">👋 欢迎使用番茄Todo</text>
        <view class="g-step"><text class="g-i">1</text><text class="g-t">在首页用 ＋ 添加待办，设定倒计时（30/60/自定义）或正向计时</text></view>
        <view class="g-step"><text class="g-i">2</text><text class="g-t">点待办进入专注页，坚持到底会种下一颗番茄 🍅（可开严格 / 学霸模式）</text></view>
        <view class="g-step"><text class="g-i">3</text><text class="g-t">统计数据看扇形分布与热力，我的-成就看等级与徽章</text></view>
        <text class="g-note">长按待办可编辑或删除；数据只存在本机，可在「我的-数据管理」导出备份</text>
        <view class="pill g-btn" @click="closeGuide"><text>开始使用</text></view>
      </view>
    </view>
    <TabDock current="/pages/task/index" />
  </view>
</template>

<style lang="scss" scoped>
/* 骨架（.t-page / .t-hero / .t-body / .t-card 等）统一在 App.vue，本页只写业务样式 */
.tb-left { display: flex; flex-direction: column; gap: 8rpx; }
.chip-row { display: flex; align-items: center; gap: 12rpx; }
.study-pill {
  align-self: flex-start;
  background: var(--p-card, rgba(255, 255, 255, 0.72));
  color: var(--p-primary, #c04a63);
  font-size: 22rpx;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
/* 今日目标胶囊：数字 + 迷你进度条，达成后整颗变主题色 */
.goal-pill {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: var(--p-card, rgba(255, 255, 255, 0.72));
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
.goal-txt { font-size: 22rpx; color: var(--p-text, #333); }
.goal-bar {
  width: 64rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.goal-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--p-primary, #c04a63);
  transition: width 0.4s ease;
}
.lv-pill {
  background: var(--p-grad, linear-gradient(135deg, #ffd166, #f0932b));
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
.tb-icon { font-size: 36rpx; &.dots { color: var(--p-sub, #8a6c72); font-size: 34rpx; letter-spacing: 2rpx; } }
.plus-btn {
  width: 66rpx; height: 66rpx; border-radius: 50%;
  background: var(--p-card, #fff); color: var(--p-primary, #c04a63);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--p-shadow, 0 6rpx 16rpx rgba(200, 90, 110, 0.18));
  .plus { font-size: 42rpx; font-weight: 300; line-height: 1; }
}
.exam-card { margin: 16rpx 24rpx 10rpx; }
.exam-in {
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(135deg, #f4708b, #f79db0);
  border-radius: 26rpx; padding: 26rpx 28rpx; color: #fff;
  box-shadow: 0 10rpx 26rpx rgba(244, 112, 139, 0.28);
}
.exam-left { display: flex; flex-direction: column; gap: 6rpx; }
.exam-title { font-size: 30rpx; font-weight: 800; text-shadow: 0 2rpx 6rpx rgba(0,0,0,0.12); }
.exam-date { font-size: 22rpx; opacity: 0.92; }
.exam-right { display: flex; align-items: flex-end; gap: 14rpx; }
.er-item { display: flex; align-items: baseline; gap: 3rpx; }
.er-n { font-size: 46rpx; font-weight: 900; }
.er-u { font-size: 22rpx; opacity: 0.92; }
.ov-strip {
  display: flex;
  margin: 4rpx 24rpx 6rpx;
  background: var(--p-card, rgba(255, 255, 255, 0.72));
  border-radius: 22rpx;
  padding: 18rpx 0;
  box-shadow: var(--p-shadow, 0 4rpx 14rpx rgba(120, 110, 130, 0.07));
}
.ov { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2rpx; }
.ov-n { font-size: 34rpx; font-weight: 800; color: var(--p-primary, #d8415d); }
.ov-c { font-size: 22rpx; color: var(--p-sub, #a08a90); }
.pick-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #f6f3f0; border-radius: 16rpx; padding: 18rpx 22rpx; font-size: 28rpx;
  .chev { color: #c9c2bc; font-size: 32rpx; }
}
.list { padding: 10rpx 24rpx 0; }
.todo {
  display: flex;
  align-items: center;
  gap: 16rpx;
  border-radius: 26rpx;
  padding: 28rpx 26rpx;
  margin-bottom: 22rpx;
  color: #fff;
  box-shadow: 0 8rpx 22rpx rgba(120, 110, 130, 0.12);
}
/* 长按触发时的“弹一下”反馈 */
@keyframes cardPop {
  0% { transform: scale(1); }
  35% { transform: scale(0.955); }
  70% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.todo.popping { animation: cardPop 0.28s cubic-bezier(0.3, 1.2, 0.4, 1); }
.t-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.t-title { font-size: 32rpx; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1rpx 3rpx rgba(0,0,0,0.12); }
/* 元信息行：卡片是彩色渐变，所以优先级/标签用半透明白底，任何配色下都能看清 */
.t-meta { display: flex; align-items: center; gap: 10rpx; flex-wrap: wrap; }
.t-min { font-size: 24rpx; opacity: 0.92; }
.t-pri {
  font-size: 22rpx;
  line-height: 1.5;
  padding: 0 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  &.high { color: #d32f2f; }
  &.low { color: #78909c; }
}
.t-tag {
  font-size: 22rpx;
  line-height: 1.5;
  padding: 0 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.26);
  color: #fff;
}
.t-times { font-size: 22rpx; opacity: 0.9; }
.t-start {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.9);
  color: #5a4a52;
  font-size: 26rpx;
  border-radius: 999rpx;
  padding: 12rpx 34rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}
.empty { display: flex; flex-direction: column; align-items: center; margin-top: 180rpx; gap: 12rpx; }
.emoji { font-size: 90rpx; }
.empty-t { font-size: 32rpx; font-weight: 700; color: var(--p-text, #333); }
.sub { font-size: 22rpx; color: var(--p-sub, #999); }
.add-first { margin-top: 18rpx; padding: 0 56rpx; height: 80rpx; font-size: 26rpx; }
/* 首次引导 */
.pop-card.guide { display: flex; flex-direction: column; gap: 16rpx; padding: 40rpx 34rpx 34rpx; }
.g-title { font-size: 36rpx; font-weight: 800; }
.g-step { display: flex; gap: 14rpx; align-items: flex-start; }
.g-i {
  width: 40rpx; height: 40rpx; border-radius: 50%; flex-shrink: 0;
  background: var(--p-grad, #e53935); color: #fff;
  font-size: 22rpx; font-weight: 800; text-align: center; line-height: 40rpx;
}
.g-t { flex: 1; font-size: 25rpx; line-height: 1.6; color: var(--p-text, #333); }
.g-note { font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.6; margin-top: 4rpx; }
.g-btn { margin-top: 16rpx; }


/* 卡片 */
.card-head { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 34rpx; font-weight: 800; color: var(--p-text, #333); }
.card-close { width: 56rpx; height: 56rpx; border-radius: 50%; background: var(--p-soft, #f2efec); color: var(--p-sub, #666); display: flex; align-items: center; justify-content: center; }
.name-input { margin-top: 26rpx; background: var(--p-soft, #f6f3f0); border-radius: 18rpx; padding: 20rpx 24rpx; font-size: 30rpx; color: var(--p-text, #333); }
.sec-label { display: block; margin-top: 26rpx; margin-bottom: 14rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.mode-seg { display: flex; border-radius: 999rpx; background: var(--p-soft, #f2efec); padding: 5rpx; }
.seg { flex: 1; text-align: center; padding: 12rpx 0; border-radius: 999rpx; font-size: 26rpx; color: var(--p-sub, #999); &.on { background: var(--p-card, #fff); color: var(--p-primary, #e53935); font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06); } }
.min-chips { display: flex; gap: 14rpx; }
.min-chip { flex: 1; text-align: center; padding: 16rpx 0; border-radius: 16rpx; background: var(--p-soft, #f6f3f0); font-size: 26rpx; &.on { background: var(--p-soft, #ffeceb); color: var(--p-primary, #e53935); font-weight: 700; border: 2rpx solid var(--p-primary, #e53935); } }
.custom-min { margin-top: 16rpx; background: var(--p-soft, #f6f3f0); border-radius: 16rpx; padding: 16rpx 22rpx; font-size: 28rpx; color: var(--p-text, #333); }
/* ---------- 优先级 / 标签（编辑弹层） ---------- */
.pri-row { display: flex; gap: 14rpx; }
.pri-chip {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: var(--p-sub, #999);
  background: var(--p-soft, #f6f3f0);
  border: 2rpx solid transparent;
  &.on { background: var(--p-card, #fff); font-weight: 700; }
}
.tag-add { display: flex; align-items: center; gap: 14rpx; margin-top: 16rpx; }
.tag-input {
  flex: 1;
  min-width: 0;
  background: var(--p-soft, #f6f3f0);
  border-radius: 14rpx;
  padding: 14rpx 20rpx;
  font-size: 26rpx;
  color: var(--p-text, #333);
}
.tag-btn {
  flex-shrink: 0;
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--p-primary, #e53935);
  background: var(--p-soft, #ffeceb);
}
/* ---------- 卡片颜色选择 ----------
   注意：这套样式原先整个缺失，色块没有宽高＝零尺寸，
   表现为"看不到也不能选颜色"。 */
.color-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16rpx; }
.sw {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
  box-shadow: inset 0 0 0 2rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.14s ease, border-color 0.14s ease;
  &:active { transform: scale(0.92); }
  &.on { border-color: var(--p-text, #333); transform: scale(1.08); }
  &.sm { width: 44rpx; height: 44rpx; }
}
.sw-auto {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--p-sub, #999);
  background: var(--p-soft, #f2efec);
  &.on { color: var(--p-primary, #e53935); font-weight: 700; background: var(--p-soft, #ffeceb); }
}
.sw-more {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--p-primary, #e53935);
  box-shadow: inset 0 0 0 2rpx currentColor;
  &.on { background: var(--p-primary, #e53935); color: #fff; box-shadow: none; }
}
.color-more { margin-top: 18rpx; background: var(--p-soft, #f8f4f2); border-radius: 20rpx; padding: 20rpx; }
.cm-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.cm-custom { display: flex; align-items: center; gap: 14rpx; margin-top: 20rpx; }
.cm-preview {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 2rpx rgba(0, 0, 0, 0.08);
}
.cm-input {
  flex: 1;
  min-width: 0;
  background: var(--p-card, #fff);
  border-radius: 14rpx;
  padding: 14rpx 20rpx;
  font-size: 26rpx;
  color: var(--p-text, #333);
}
.cm-apply {
  flex-shrink: 0;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  background: var(--p-grad, var(--p-primary, #e53935));
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}
.cm-tip { display: block; margin-top: 14rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.card-actions { display: flex; align-items: center; gap: 16rpx; margin-top: 34rpx; }
.btn-danger { color: var(--p-primary, #e53935); background: var(--p-soft, #fff0ef); border-radius: 999rpx; padding: 18rpx 30rpx; font-size: 26rpx; }
.btn-space { flex: 1; }
.btn-cancel { background: var(--p-soft, #f2efec); color: var(--p-sub, #666); border-radius: 999rpx; padding: 18rpx 40rpx; font-size: 26rpx; }
.btn-save { background: var(--p-grad, var(--p-primary, #e53935)); color: #fff; border-radius: 999rpx; padding: 18rpx 48rpx; font-size: 28rpx; font-weight: 700; box-shadow: var(--p-shadow, 0 8rpx 20rpx rgba(229,57,53,.3)); }
</style>
