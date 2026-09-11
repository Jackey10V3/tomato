<script setup lang="ts">
/**
 * 强力专注模式：学霸模式 / 严格模式 / 阈值 / 白名单
 */
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { themeStyle } from '@/utils/theme'
import { PRESET_BLOCKED, type WhitelistItem } from '@/types/app'

const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const { layoutClass } = useResponsive()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const hdrStyle = computed(() => ({
  paddingTop: statusBarH + 'px',
  background: `linear-gradient(180deg, ${style.value['--p-light']}, ${style.value['--p-bg']})`,
}))
const guard = computed(() => settings.s.focusGuard)

const showPicker = ref(false)
const candidates = computed(() =>
  PRESET_BLOCKED.filter(p => !settings.s.focusGuard.whitelist.some(w => w.pkg === p.pkg)),
)

function setStudyHard(v: boolean) {
  settings.updateGuard({ studyHard: v })
  uni.showToast({ title: v ? '学霸模式已开启' : '学霸模式已关闭', icon: 'none' })
}
function setStrict(v: boolean) {
  settings.updateGuard({ strict: v })
  uni.showToast({ title: v ? '严格模式已开启' : '严格模式已关闭', icon: 'none' })
}
function addWhitelist(item: WhitelistItem) {
  settings.addWhitelist(item)
  showPicker.value = false
  uni.showToast({ title: `已加入白名单：${item.name}`, icon: 'none' })
}
function addCustom() {
  showPicker.value = false
  uni.showModal({
    title: '添加白名单应用',
    editable: true,
    placeholderText: '应用包名，如 com.android.chrome',
    success: r => {
      const pkg = (r as unknown as { content?: string }).content?.trim()
      if (pkg) settings.addWhitelist({ name: pkg.split('.').pop() || pkg, pkg })
    },
  })
}
</script>

<template>
  <view class="screen" :class="layoutClass" :style="style">
    <view class="t-header" :style="hdrStyle">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">强力专注</text>
    </view>

    <scroll-view scroll-y class="body">
      <!-- 学霸模式 -->
      <view class="card">
        <view class="mode-head">
          <view class="lbl">
            <text class="m-title">🎓 学霸模式</text>
            <text class="m-desc">强制自律：计时期间离开 App 玩手机，会被警告；多次警告或离开过久，本次专注直接作废，无法抵赖</text>
          </view>
          <view class="sw" :class="{ on: guard.studyHard }" @click="setStudyHard(!guard.studyHard)" />
        </view>
        <view class="sub-line" v-if="guard.studyHard">
          <text>当前生效规则：单次离开 ≤ {{ guard.leaveGraceSec }} 秒 / 累计警告 {{ guard.warnLimit }} 次内返回不追究</text>
        </view>
      </view>

      <!-- 严格模式 -->
      <view class="card">
        <view class="mode-head">
          <view class="lbl">
            <text class="m-title">🔒 严格模式</text>
            <text class="m-desc">计时开始后，不允许暂停 / 提前结束 / 放弃，必须坚持到番茄成熟，否则该次专注不计入完成</text>
          </view>
          <view class="sw" :class="{ on: guard.strict }" @click="setStrict(!guard.strict)" />
        </view>
      </view>

      <!-- 阈值 -->
      <view class="card" v-if="guard.studyHard">
        <text class="m-title sm">⚙️ 学霸规则阈值</text>
        <view class="row">
          <text>累计警告次数上限</text>
          <view class="stepper">
            <view class="step" @click="settings.updateGuard({ warnLimit: Math.max(1, guard.warnLimit - 1) })">−</view>
            <text class="num">{{ guard.warnLimit }} 次</text>
            <view class="step" @click="settings.updateGuard({ warnLimit: Math.min(8, guard.warnLimit + 1) })">＋</view>
          </view>
        </view>
        <view class="row">
          <text>单次离开宽限（秒）</text>
          <view class="stepper">
            <view class="step" @click="settings.updateGuard({ leaveGraceSec: Math.max(10, guard.leaveGraceSec - 10) })">−</view>
            <text class="num">{{ guard.leaveGraceSec }}s</text>
            <view class="step" @click="settings.updateGuard({ leaveGraceSec: Math.min(600, guard.leaveGraceSec + 10) })">＋</view>
          </view>
        </view>
      </view>

      <!-- 白名单 -->
      <view class="card">
        <view class="mode-head">
          <view class="lbl">
            <text class="m-title">✅ 专注白名单</text>
            <text class="m-desc">学霸模式下仍允许使用的应用（如查资料的浏览器、背单词、音乐）。App 端检测依赖系统权限由原生插件实现（当前为名单管理）</text>
          </view>
        </view>
        <view v-if="guard.whitelist.length" class="wl">
          <view v-for="w in guard.whitelist" :key="w.pkg" class="wl-chip">
            <text>{{ w.name }}</text>
            <text class="pkg">{{ w.pkg }}</text>
            <text class="x" @click="settings.removeWhitelist(w.pkg)">×</text>
          </view>
        </view>
        <text v-else class="empty-wl">尚未添加白名单应用</text>
        <view class="add-btn" @click="showPicker = true">＋ 添加白名单应用</view>
      </view>

      <view class="card note">
        <text>说明：H5 演示中「离席」按浏览器切到其他标签 / 最小化窗口判定；手机 App 端将在原生层（前台服务 / 鸿蒙长时任务）实现真正的应用级检测与拦截（设计方案 4.4，TODO M7）。白名单与规则已在本机持久化。</text>
      </view>
      <view class="bottom-space" />
    </scroll-view>

    <!-- 白名单选择弹层 -->
    <view v-if="showPicker" class="mask" @click="showPicker = false">
      <view class="sheet" @click.stop>
        <view class="sheet-title">添加白名单</view>
        <view class="opt" v-for="c in candidates" :key="c.pkg" @click="addWhitelist(c)">
          <text>{{ c.name }}</text>
          <text class="pkg">{{ c.pkg }}</text>
        </view>
        <view class="opt custom" @click="addCustom">＋ 手动输入包名</view>
        <view v-if="!candidates.length" class="opt disabled">已添加全部常用应用</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.body { height: calc(100vh - 110rpx); }
.card { padding: 26rpx; }
.mode-head { display: flex; justify-content: space-between; align-items: center; gap: 24rpx; }
.lbl { flex: 1; }
.m-title { font-size: 30rpx; font-weight: 700; &.sm { display: block; margin-bottom: 4rpx; } }
.m-desc { display: block; font-size: 22rpx; color: var(--p-sub, #777); margin-top: 8rpx; line-height: 1.7; }
.sw {
  width: 92rpx; height: 52rpx; border-radius: 999rpx; background: var(--p-border, #d9d2cc); position: relative; flex-shrink: 0; transition: background 0.2s;
  &::after { content: ''; position: absolute; top: 6rpx; left: 6rpx; width: 40rpx; height: 40rpx; border-radius: 50%; background: #fff; transition: transform 0.2s; }
  &.on { background: var(--p-primary, #e53935); &::after { transform: translateX(40rpx); } }
}
.sub-line { margin-top: 16rpx; font-size: 22rpx; color: var(--p-primary, #e53935); background: #fff5f4; border-radius: 14rpx; padding: 12rpx 16rpx; }
.row {
  display: flex; align-items: center; justify-content: space-between; padding: 22rpx 0; font-size: 26rpx;
  border-bottom: 2rpx solid #f7f4f1; &:last-child { border-bottom: none; }
}
.stepper { display: flex; align-items: center; gap: 18rpx; }
.step { width: 52rpx; height: 52rpx; border-radius: 50%; background: var(--p-soft, #f2efec); display: flex; align-items: center; justify-content: center; }
.num { min-width: 90rpx; text-align: center; font-weight: 700; }
.wl { margin-top: 16rpx; display: flex; flex-direction: column; gap: 12rpx; }
.wl-chip {
  display: flex; align-items: center; gap: 12rpx;
  background: #f6f3f0; border-radius: 16rpx; padding: 12rpx 18rpx;
  font-size: 26rpx;
  .pkg { flex: 1; font-size: 22rpx; color: var(--p-sub, #999); }
  .x { color: #c9c2bc; font-size: 30rpx; }
}
.empty-wl { display: block; margin-top: 16rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.add-btn { margin-top: 18rpx; text-align: center; color: var(--p-primary, #e53935); font-size: 28rpx; background: #fff5f4; border-radius: 16rpx; padding: 16rpx; }
.note { font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.7; }
.bottom-space { height: 80rpx; }
.mask { position: fixed; inset: 0; background: rgba(10, 6, 4, 0.55); z-index: 99; display: flex; align-items: flex-end; }
.sheet {
  width: 100%; background: #fff; border-radius: 36rpx 36rpx 0 0; padding: 30rpx 32rpx calc(30rpx + env(safe-area-inset-bottom));
  .sheet-title { font-size: 30rpx; font-weight: 700; margin-bottom: 10rpx; }
  .opt {
    display: flex; align-items: center; gap: 16rpx; padding: 24rpx 8rpx;
    border-bottom: 2rpx solid #f5f1ed; font-size: 28rpx;
    .pkg { flex: 1; font-size: 22rpx; color: var(--p-sub, #999); }
    &.custom { color: var(--p-primary, #e53935); border-bottom: none; }
    &.disabled { color: #ccc; }
  }
}
</style>
