<script setup lang="ts">
/** 我的：本地账号 / 等级与成就 / 外观音效 / 数据安全（导出导入备份）/ 分组设置 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSettingsStore } from '@/store/modules/settings'
import { useTaskStore } from '@/store/modules/task'
import { useFocusStore } from '@/store/modules/focus'
import { useAuthStore } from '@/store/modules/auth'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { useEnterAnim } from '@/composables/useEnterAnim'
import { usePageError } from '@/composables/usePageError'
import { useNativeTabBar } from '@/composables/useNativeTabBar'
import PageError from '@/components/PageError.vue'
import TabDock from '@/components/TabDock.vue'
import { themeStyle, themeOptions, posterBg } from '@/utils/theme'
import { markProfileDirty, syncNow, cloudEnabled, lastSyncInfo } from '@/utils/cloudSync'
import { useCanvasBg } from '@/composables/useCanvasBg'
import { buildBackup, parseBackup } from '@/utils/backup'
import { MOTIVATIONS } from '@/utils/constant'
import type { ThemeKey } from '@/types/app'

const settings = useSettingsStore()
const taskStore = useTaskStore()
const focusStore = useFocusStore()
const auth = useAuthStore()
const { statusBarH } = useChrome()
const { layoutClass } = useResponsive()
// 每次切回本页都重播内容入场动画
const { animKey } = useEnterAnim()
/** 渲染出错时显示错误卡而不是白屏 */
const { pageError, copyErr, dismiss: dismissErr } = usePageError('mine-page')
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
// 沉浸式：画布刷页面同款底色
useCanvasBg(() => posterBg(settings.s.poster))
const poster = computed(() => posterBg(settings.s.poster))
const slogan = ref(MOTIVATIONS[(Math.random() * MOTIVATIONS.length) | 0])
const level = computed(() => focusStore.levelInfo)
const totalDays = computed(() => new Set(focusStore.records.filter(r => r.kind === 'focus').map(r => r.dateKey)).size)

const AVATARS = ['🍅', '🎯', '🌱', '🔥', '🐱', '🐻', '🐼', '🦊', '🐤', '🌙', '⭐', '📚']
const picker = ref(false)

/** 云同步状态（上次同步时间 / 失败原因），点击立即同步 */
const syncInfo = ref(lastSyncInfo())
const syncingNow = ref(false)
const syncDesc = computed(() => {
  if (!cloudEnabled()) return '未登录云端 · 登录后自动同步'
  if (syncInfo.value.error) return `上次同步失败：${syncInfo.value.error} · 点按重试`
  if (!syncInfo.value.at) return '尚未同步 · 点按立即同步'
  const d = new Date(syncInfo.value.at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `上次同步 ${hh}:${mm} · 点按立即同步`
})
async function manualSync() {
  if (syncingNow.value) return
  if (!cloudEnabled()) {
    uni.showToast({ title: '请先登录云端账号', icon: 'none' })
    return
  }
  syncingNow.value = true
  uni.showLoading({ title: '同步中…', mask: true })
  const r = await syncNow('manual')
  uni.hideLoading()
  syncInfo.value = lastSyncInfo()
  syncingNow.value = false
  uni.showToast({ title: r.ok ? '同步完成' : `同步失败：${r.msg}`, icon: 'none', duration: 2600 })
}

function editNickname() {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '输入昵称',
    content: settings.s.nickname,
    success: r => {
      const v = (r as unknown as { content?: string }).content?.trim()
      if (v) {
        settings.update({ nickname: v })
        markProfileDirty()
        if (auth.isLogin) auth.rename(v)
        uni.showToast({ title: '已更新', icon: 'success' })
      }
    },
  })
}
function pickTheme(key: ThemeKey) {
  settings.setTheme(key)
}
function go(url: string) {
  uni.navigateTo({ url })
}
function coming() {
  uni.showToast({ title: '开发中，敬请期待', icon: 'none' })
}
function about() {
  uni.showModal({
    title: '🍅 番茄Todo',
    content: '数据全部保存在本机，升级不会覆盖；建议定期「导出备份」。云同步 / 自习室 / 桌面小组件正在路上。',
    showCancel: false,
  })
}

/** 导出备份到剪贴板 */
function exportBackup() {
  const json = buildBackup({
    tasks: taskStore.exportAll().tasks,
    lists: taskStore.exportAll().lists,
    records: focusStore.exportAll(),
    settings: settings.exportAll(),
  })
  uni.setClipboardData({
    data: json,
    success: () => uni.showModal({ title: '备份已复制', content: `数据已复制到剪贴板（${json.length} 字符）。建议粘贴到备忘录 / 电脑保存。`, showCancel: false }),
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
  })
}
/** 从剪贴板恢复备份 */
function importBackup() {
  uni.getClipboardData({
    success: res => {
      const payload = parseBackup(String(res.data || ''))
      if (!payload) {
        uni.showToast({ title: '剪贴板里没有有效的备份', icon: 'none' })
        return
      }
      uni.showModal({
        title: '恢复备份',
        content: '将用备份内容覆盖当前的待办 / 专注记录 / 设置，确定继续？',
        confirmColor: '#e53935',
        success: r => {
          if (!r.confirm) return
          taskStore.importAll({ tasks: payload.tasks as never, lists: payload.lists as never })
          focusStore.importAll(payload.records as never)
          settings.replaceAll(payload.settings as never)
          focusStore.$patch({})
          uni.showToast({ title: '恢复完成', icon: 'success' })
        },
      })
    },
    fail: () => uni.showToast({ title: '读取剪贴板失败', icon: 'none' }),
  })
}

function dataMenu() {
  uni.showActionSheet({
    itemList: ['导出备份（复制到剪贴板）', '从剪贴板恢复备份', '清除已完成任务', '清空专注记录', '恢复默认设置'],
    success: r => {
      if (r.tapIndex === 0) return exportBackup()
      if (r.tapIndex === 1) return importBackup()
      if (r.tapIndex === 2) return taskStore.clearDone()
      if (r.tapIndex === 3) {
        uni.showModal({
          title: '清空专注记录',
          content: '所有历史流水与统计将删除，且不可恢复（建议先导出备份）',
          confirmColor: '#e53935',
          success: x => x.confirm && (focusStore.clearAll(), uni.showToast({ title: '已清空', icon: 'success' })),
        })
        return
      }
      settings.resetAll()
      uni.showToast({ title: '已恢复默认', icon: 'success' })
    },
  })
}

useNativeTabBar()
onShow(() => {
  taskStore.loadLocal()
  settings.applySideEffects()
  syncInfo.value = lastSyncInfo()
})
</script>

<template>
  <view class="screen t-page" :class="layoutClass" :style="[style, { background: poster }]">
    <!-- 雪山 Hero -->
    <view class="t-hero bold slide-in-left" :key="animKey" :style="{ paddingTop: statusBarH + 'px' }">
      <view class="hero-top">
        <view class="avatar" @click="picker = true"><text>{{ settings.s.avatar }}</text></view>
        <view class="hi-text">
          <text class="nick" @click="editNickname">{{ settings.s.nickname }} <text class="edit">✎</text></text>
          <view class="pills">
            <view class="h-pill lv" @click="go('/pages/mine/achievements')"><text>Lv.{{ level.level }}</text><text class="v">{{ level.title }}</text></view>
            <view class="h-pill"><text>共专注</text><text class="v">{{ totalDays }}</text><text>天</text></view>
            <view class="h-pill"><text>连续</text><text class="v">{{ focusStore.summary.streakDays }}</text><text>天</text></view>
          </view>
        </view>
        <view class="hero-icons"><text @click="go('/pages/login/index')">{{ auth.isLogin ? '👤' : '登录' }}</text></view>
      </view>
      <text class="slogan">{{ slogan }}</text>

      <view class="ts-strip">
        <view v-for="t in themeOptions" :key="t.key" class="ts" @click="pickTheme(t.key)">
          <view class="tsw" :class="{ on: settings.s.theme === t.key }" :style="{ background: `linear-gradient(135deg, ${t.gradientLight}, ${t.gradientDeep})` }" />
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="t-body">
      <view :key="animKey">
        <PageError v-if="pageError" :message="pageError" @copy="copyErr" @dismiss="dismissErr" />
        <!-- 宽屏（.is-2col）下这里会变成两栏，见 App.vue 的 .t-flow -->
        <view class="t-flow">
          <!-- 三宫格 -->
        <view class="t-card grid-card slide-in-left mine-delay-1">
          <view class="grid-item press" @click="go('/pages/mine/achievements')"><text class="g-ico gold">🏆</text><text class="g-name">成就与等级</text></view>
          <view class="grid-item press" @click="go('/pages/stats/index')"><text class="g-ico blue">📜</text><text class="g-name">专注记录</text></view>
          <view class="grid-item press" @click="coming"><text class="g-ico red">🏛️</text><text class="g-name">自习室 | 许愿墙</text></view>
        </view>

        <!-- 账号 -->
        <view class="t-card tight slide-in-left mine-delay-2">
          <view class="t-row press" @click="go('/pages/login/index')">
            <text class="t-row-icon ri blue">👤</text>
            <view class="t-row-main">
              <text class="t-row-title">{{ auth.isLogin ? auth.displayName : '本地登录 / 注册' }}</text>
              <text class="t-row-desc">{{ auth.isLogin ? `账号：${auth.account}（本地，未联网）` : '离线账号，数据只存本机' }}</text>
            </view>
          </view>
          <view class="t-row press" @click="manualSync">
            <text class="t-row-icon ri green">☁️</text>
            <view class="t-row-main">
              <text class="t-row-title">云同步{{ auth.isLogin ? '' : '（未登录）' }}</text>
              <text class="t-row-desc">{{ syncDesc }}</text>
            </view>
          </view>
          <view class="t-row press" @click="coming">
            <text class="tag">VIP</text>
            <view class="t-row-main"><text class="t-row-title">季度卡</text><text class="t-row-desc">众多新颖高级功能，助你养成专注好习惯</text></view>
          </view>
        </view>

        <!-- 外观与设置 -->
        <view class="t-card tight slide-in-left mine-delay-3">
          <view class="t-row press" @click="go('/pages/mine/appearance')">
            <text class="t-row-icon ri pink">🎨</text>
            <view class="t-row-main"><text class="t-row-title">外观与音效</text><text class="t-row-desc">主题 | 深色模式 | 背景海报 | 提示音 | 音量</text></view>
          </view>
          <view class="t-row press" @click="go('/pages/mine/settings')">
            <text class="t-row-icon ri purple">⏱️</text>
            <view class="t-row-main"><text class="t-row-title">专注计时核心设置</text><text class="t-row-desc">专注时长 | 休息时长 | 自动衔接 | 午夜模式</text></view>
          </view>
          <view class="t-row press" @click="go('/pages/mine/guards')">
            <text class="t-row-icon ri red">🛡️</text>
            <view class="t-row-main"><text class="t-row-title">强力专注模式</text><text class="t-row-desc">{{ settings.s.focusGuard.strict ? '严格' : '' }}{{ settings.s.focusGuard.studyHard ? '学霸' : '未开启' }} · 白名单</text></view>
          </view>
          <view class="t-row press" @click="coming">
            <text class="t-row-icon ri cyan">🟦</text>
            <view class="t-row-main"><text class="t-row-title">桌面小组件选项</text><text class="t-row-desc">小组件背景图等（开发中）</text></view>
          </view>
        </view>

        <!-- 数据安全 -->
        <view class="t-card tight slide-in-left mine-delay-4">
          <view class="t-row press" @click="dataMenu">
            <text class="t-row-icon ri gray">🗄️</text>
            <view class="t-row-main"><text class="t-row-title">数据管理</text><text class="t-row-desc">导出备份 | 恢复 | 清理（更新不会覆盖你的数据）</text></view>
          </view>
          <view class="t-row press" @click="about">
            <text class="t-row-icon ri gray">ℹ️</text>
            <view class="t-row-main"><text class="t-row-title">关于</text></view>
          </view>
          <view class="t-row press" @click="go('/pages/mine/debug')">
            <text class="t-row-icon ri gray">🧪</text>
            <view class="t-row-main"><text class="t-row-title">诊断信息</text><text class="t-row-desc">白屏/报错排查：错误日志与设备信息</text></view>
          </view>
        </view>
        </view>
          <view class="t-bottom-space" />
      </view>
    </scroll-view>

    <!-- 头像选择 -->
    <view v-if="picker" class="pop-mask" @click="picker = false">
      <view class="pop-card" @click.stop>
        <view class="card-head"><text class="card-title">选择头像</text><text class="card-close" @click="picker = false">✕</text></view>
        <view class="avatar-grid">
          <view v-for="a in AVATARS" :key="a" class="av" :class="{ on: settings.s.avatar === a }" @click="settings.update({ avatar: a }); markProfileDirty(); picker = false"><text>{{ a }}</text></view>
        </view>
      </view>
    </view>
    <TabDock current="/pages/mine/index" />
  </view>
</template>

<style lang="scss" scoped>
/* 内容分层入场（配合 useEnterAnim，每次切回本页都重播） */
.mine-delay-1 { animation-delay: 70ms; }
.mine-delay-2 { animation-delay: 140ms; }
.mine-delay-3 { animation-delay: 210ms; }
.mine-delay-4 { animation-delay: 280ms; }
/* 英雄区内部元素（外壳骨架 .t-hero.bold 在 App.vue） */
.t-hero.bold {
  .hero-top { display: flex; align-items: center; gap: 20rpx; }
  .avatar {
    width: 120rpx; height: 120rpx; border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    display: flex; align-items: center; justify-content: center; font-size: 64rpx;
    box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.2);
  }
  .hi-text { flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
  .nick { font-size: 34rpx; font-weight: 800; .edit { font-size: 22rpx; opacity: 0.85; } }
  .pills { display: flex; gap: 10rpx; flex-wrap: wrap; }
  .h-pill {
    display: flex; align-items: center; gap: 4rpx;
    background: rgba(255, 255, 255, 0.22);
    border-radius: 999rpx; padding: 4rpx 16rpx; font-size: 22rpx;
    .v { font-weight: 800; }
    &.lv { background: var(--p-soft, rgba(255,255,255,0.22)); color: #fff; border: 1rpx solid rgba(255, 255, 255, 0.6); font-weight: 800; }
  }
  .hero-icons { font-size: 28rpx; opacity: 0.95; align-self: flex-start; }
  .slogan { display: block; margin-top: 18rpx; font-size: 24rpx; opacity: 0.92; }
  .ts-strip { display: flex; gap: 16rpx; margin-top: 20rpx; }
  .ts { flex: 1; }
  .tsw { height: 48rpx; border-radius: 14rpx; border: 3rpx solid transparent; }
  .tsw.on { border-color: #fff; }
}
.grid-card { padding: 26rpx 10rpx; display: flex; }
.grid-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.g-ico { font-size: 46rpx; &.gold { color: var(--p-primary, #e0a800); } &.blue { color: var(--p-primary, #1e88e5); } &.red { color: var(--p-primary, #f2607c); } }
.g-name { font-size: 22rpx; color: var(--p-sub, #666); }
.tag { font-size: 22rpx; color: #fff; background: #b9a2a8; border-radius: 8rpx; padding: 2rpx 10rpx; font-weight: 700; }
.ri { &.blue { color: #1e88e5; } &.purple { color: #8e24aa; } &.red { color: #f2607c; } &.cyan { color: #00acc1; } &.pink { color: #ec407a; } &.gray { color: #909399; } &.green { color: #2e7d32; } }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 34rpx; font-weight: 800; }
.card-close { width: 56rpx; height: 56rpx; border-radius: 50%; background: #f2efec; display: flex; align-items: center; justify-content: center; }
.avatar-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18rpx; margin-top: 24rpx; }
.av { aspect-ratio: 1; border-radius: 20rpx; background: #f6f3f0; display: flex; align-items: center; justify-content: center; font-size: 48rpx; border: 3rpx solid transparent; &.on { border-color: var(--p-primary, #e53935); background: #ffeceb; } }
</style>
