<script setup lang="ts">
/** 诊断信息：展示运行时错误、设备与环境、本地数据量，便于手机端排障 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useChrome } from '@/composables/usePageChrome'
import { useSettingsStore } from '@/store/modules/settings'
import { listErrors, clearErrors, errorText, type DebugError } from '@/utils/debugLog'
import { themeStyle } from '@/utils/theme'
import { dataVersion } from '@/utils/migrate'
import { storage } from '@/utils/storage'

const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))

const errors = ref<DebugError[]>([])
const sys = ref<Record<string, unknown>>({})
const counts = ref({ tasks: 0, lists: 0, records: 0 })

function refresh() {
  errors.value = listErrors()
  try {
    const info = uni.getSystemInfoSync() as unknown as Record<string, unknown>
    sys.value = {
      platform: info.platform,
      system: info.system,
      brand: info.brand,
      model: info.model,
      uniVersion: (info as { uniVersion?: string }).uniVersion,
      SDKVersion: info.SDKVersion,
      isDark: info.theme,
      schemaVersion: dataVersion(),
    }
  } catch {
    sys.value = {}
  }
  try {
    const rawT = storage.get<string>('task:list')
    const rawL = storage.get<string>('task:lists')
    const rawR = storage.get<string>('focus:records:v1')
    counts.value = {
      tasks: rawT ? (JSON.parse(rawT) as unknown[]).length : 0,
      lists: rawL ? (JSON.parse(rawL) as unknown[]).length : 0,
      records: rawR ? (JSON.parse(rawR) as unknown[]).length : 0,
    }
  } catch {
    /* ignore */
  }
}
function copyAll() {
  const text = `【诊断信息】\n${JSON.stringify(sys.value, null, 2)}\n数据量：${JSON.stringify(counts.value)}\n\n【错误】\n${errorText() || '（无）'}`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制，可发给开发者', icon: 'none' }),
  })
}
function clearAll() {
  clearErrors()
  refresh()
  uni.showToast({ title: '已清空', icon: 'success' })
}
function fmt(t: number) {
  const d = new Date(t)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onShow(refresh)
</script>

<template>
  <view class="screen" :style="style">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">诊断信息</text>
      <view class="t-right"><text class="op" @click="copyAll">复制全部</text></view>
    </view>

    <scroll-view scroll-y class="body">
      <view class="card">
        <text class="sec-h">环境与数据</text>
        <view v-for="(v, k) in sys" :key="k" class="row"><text class="k">{{ k }}</text><text class="v">{{ v }}</text></view>
        <view class="row"><text class="k">任务 / 清单 / 记录</text><text class="v">{{ counts.tasks }} / {{ counts.lists }} / {{ counts.records }}</text></view>
      </view>

      <view class="card">
        <view class="head-row">
          <text class="sec-h">错误日志（{{ errors.length }}）</text>
          <text v-if="errors.length" class="op" @click="clearAll">清空</text>
        </view>
        <view v-if="!errors.length" class="empty">暂无错误记录 🎉</view>
        <view v-for="(e, i) in errors" :key="i" class="err">
          <text class="err-t">[{{ fmt(e.time) }}] {{ e.where }}</text>
          <text class="err-m">{{ e.message }}</text>
        </view>
      </view>
      <view class="note">提示：统计页若白屏，此页会记录到具体报错（点「复制全部」发我即可）。</view>
      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.body { height: calc(100vh - 130rpx); }
.card { background: var(--p-card, #fff); border-radius: 24rpx; margin: 18rpx 24rpx; padding: 24rpx; box-shadow: var(--p-shadow, 0 6rpx 18rpx rgba(0,0,0,.05)); }
.sec-h { font-size: 26rpx; font-weight: 800; color: var(--p-primary, #e53935); }
.head-row { display: flex; align-items: center; justify-content: space-between; }
.op { font-size: 24rpx; color: var(--p-primary, #e53935); }
.row { display: flex; justify-content: space-between; gap: 20rpx; padding: 12rpx 0; border-bottom: 2rpx solid var(--p-border, #f4f0f2); &:last-child { border-bottom: none; } }
.k { font-size: 24rpx; color: var(--p-sub, #999); }
.v { font-size: 24rpx; color: var(--p-text, #333); flex: 1; text-align: right; word-break: break-all; }
.empty { font-size: 24rpx; color: var(--p-sub, #999); padding: 18rpx 0; }
.err { padding: 14rpx 0; border-bottom: 2rpx solid var(--p-border, #f4f0f2); &:last-child { border-bottom: none; } }
.err-t { font-size: 22rpx; color: var(--p-primary, #e53935); font-weight: 700; }
.err-m { display: block; margin-top: 6rpx; font-size: 22rpx; color: var(--p-text, #333); word-break: break-all; }
.note { margin: 0 28rpx; font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.7; }
.bottom-space { height: 60rpx; }
</style>
