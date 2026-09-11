<script setup lang="ts">
/** 专注记录：全部流水（筛选 / 删除 / 汇总），统计页「查看专注记录」入口 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useFocusStore, MIN_STAT_SEC, isTooShort } from '@/store/modules/focus'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useEnterAnim } from '@/composables/useEnterAnim'
import { themeStyle, posterBg } from '@/utils/theme'
import { dateTimeKey, formatMs } from '@/utils/date'
import type { FocusRecord } from '@/types/focus'

const store = useFocusStore()
const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const { animKey } = useEnterAnim()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))

type Filter = 'all' | 'completed' | 'giveup'
const filter = ref<Filter>('all')
const FILTERS: { k: Filter; label: string }[] = [
  { k: 'all', label: '全部' },
  { k: 'completed', label: '完成' },
  { k: 'giveup', label: '放弃/作废' },
]

const RESULT_META: Record<FocusRecord['result'], { label: string; color: string }> = {
  completed: { label: '完成', color: '#43a047' },
  manual: { label: '手动结束', color: '#1e88e5' },
  giveup: { label: '放弃', color: '#f9a825' },
  abandoned: { label: '学霸作废', color: '#e53935' },
}

const list = computed(() => {
  const all = store.timeline
  if (filter.value === 'completed') return all.filter(r => r.result === 'completed' || r.result === 'manual')
  if (filter.value === 'giveup') return all.filter(r => r.result === 'giveup' || r.result === 'abandoned')
  return all
})

const totalShown = computed(() => {
  const minutes = list.value
    .filter(r => (r.result === 'completed' || r.result === 'manual') && r.actualSec >= MIN_STAT_SEC)
    .reduce((a, b) => a + b.actualSec / 60, 0)
  const short = list.value.filter(r => isTooShort(r)).length
  return `共 ${list.value.length} 条 · 有效专注 ${Math.round(minutes)} 分钟${short ? ` · ${short} 条过短未计入` : ''}`
})

function fmt(ts: number) {
  // 与全局统一的日期时间格式（含补零规则），不再自己拼一遍
  return dateTimeKey(new Date(ts))
}
function del(r: FocusRecord) {
  uni.showModal({
    title: '删除这条记录',
    content: `${r.taskTitle || '自由专注'} · ${fmt(r.startedAt)}`,
    confirmColor: '#e53935',
    success: res => res.confirm && store.removeById(r._id),
  })
}
function exportText() {
  const lines = list.value
    .slice(0, 200)
    .map(r => `${fmt(r.startedAt)} ${r.taskTitle || '自由专注'} ${Math.round(r.actualSec / 60)}分钟 ${RESULT_META[r.result].label}`)
  const text = `【番茄Todo 专注记录】\n${totalShown.value}\n${lines.join('\n')}`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制记录文本', icon: 'success' }),
  })
}

onShow(() => {
  settings.applySideEffects()
})
</script>

<template>
  <view class="screen" :style="[style, { background: poster }]">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">专注记录</text>
      <view class="t-right"><text class="share" @click="exportText">导出</text></view>
    </view>

    <view class="filters">
      <view v-for="f in FILTERS" :key="f.k" class="f press" :class="{ on: filter === f.k }" @click="filter = f.k">{{ f.label }}</view>
    </view>
    <text class="sum">{{ totalShown }}</text>

    <scroll-view scroll-y class="body">
      <view :key="animKey" class="rec-list">
        <!-- key 里带上筛选维度：切换「全部/完成/放弃」时列表重播入场动画 -->
        <view
          v-for="(r, i) in list"
          :key="filter + '-' + r._id"
          class="rec fade-row press"
          :style="{ animationDelay: Math.min(i * 28, 300) + 'ms' }"
          @longpress="del(r)"
        >
          <view class="ico" :style="{ background: style['--p-soft'] }">{{ r.kind === 'focus' ? '🍅' : '☕' }}</view>
          <view class="main">
            <view class="top">
              <text class="name">{{ r.taskTitle || '自由专注' }}</text>
              <text v-if="isTooShort(r)" class="short">＜3分钟 未计入</text>
              <text class="res" :style="{ color: RESULT_META[r.result].color }">{{ RESULT_META[r.result].label }}</text>
            </view>
            <text class="sub">{{ fmt(r.startedAt) }} · {{ formatMs(r.actualSec * 1000) }} · {{ r.mode === 'countup' ? '正向' : '倒计' }}{{ r.leaveTimes ? ` · 离席 ${r.leaveTimes} 次` : '' }}</text>
          </view>
        </view>

        <view v-if="!list.length" class="empty">
          <text class="emoji">📭</text>
          <text>{{ filter === 'all' ? '还没有记录，去待办开始一次专注吧' : '这个筛选下暂时没有记录' }}</text>
          <text class="sub">单次专注满 3 分钟才会计入统计</text>
        </view>
        <view class="tip">长按任意记录可删除</view>
        <view class="bottom-space" />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
/* 注意：scroll-view 自身在 App 端不吃左右 padding，所以内边距放在内部容器上 */
.body { height: calc(100vh - 300rpx); }
.rec-list { padding: 0 24rpx; }
.share { font-size: 26rpx; color: var(--p-primary, #e53935); font-weight: 700; }
.filters { display: flex; gap: 14rpx; padding: 14rpx 28rpx 0; }
.f {
  padding: 8rpx 26rpx; border-radius: 999rpx;
  background: var(--p-card, #fff); color: var(--p-sub, #999); font-size: 24rpx;
  &.on { background: var(--p-grad, var(--p-primary, #e53935)); color: #fff; font-weight: 700; }
}
.sum { display: block; padding: 14rpx 30rpx 6rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.rec {
  display: flex; align-items: center; gap: 18rpx;
  background: var(--p-card, #fff); border-radius: 22rpx; padding: 20rpx; margin-bottom: 14rpx;
  box-shadow: var(--p-shadow, 0 4rpx 14rpx rgba(0,0,0,.04));
}
.ico { width: 72rpx; height: 72rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; font-size: 36rpx; flex-shrink: 0; }
.main { flex: 1; min-width: 0; }
.top { display: flex; align-items: center; gap: 12rpx; }
.name { flex: 1; font-size: 28rpx; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res { font-size: 18rpx; border: 1rpx solid currentColor; border-radius: 8rpx; padding: 0 8rpx; flex-shrink: 0; }
.short { font-size: 17rpx; color: var(--p-sub, #999); background: var(--p-soft, #f3efeb); border-radius: 8rpx; padding: 0 8rpx; flex-shrink: 0; }
.sub { font-size: 20rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 12rpx; margin-top: 160rpx; color: var(--p-sub, #999); font-size: 26rpx; .emoji { font-size: 80rpx; } .sub { font-size: 20rpx; color: var(--p-sub, #bbb); } }
.tip { text-align: center; font-size: 20rpx; color: var(--p-sub, #bbb); margin-top: 16rpx; }
.bottom-space { height: 80rpx; }
</style>
