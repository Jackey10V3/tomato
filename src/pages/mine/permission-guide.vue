<script setup lang="ts">
/**
 * 权限引导页：说明各能力所需权限及安卓/鸿蒙差异（设计方案 4.4）
 */
import { computed } from 'vue'
import { permission } from '@/platform/permission'

const platformName = computed(() => {
  try {
    const p = uni.getSystemInfoSync().platform
    if (p === 'android') return 'Android'
    if (p === 'ios') return 'iOS'
    return 'HarmonyOS / 其他'
  } catch {
    return 'HarmonyOS / 其他'
  }
})

const ITEMS = [
  {
    key: 'notify',
    icon: '🔔',
    title: '通知权限',
    android: 'Android 13+ 需要运行时授权，用于计时完成/休息提醒与通知栏进度',
    harmony: '需引导开启通知，配合长时任务展示持续通知',
    action: '申请',
  },
  {
    key: 'overlay',
    icon: '🪟',
    title: '悬浮窗权限',
    android: '仅 Android 支持悬浮窗（专注倒计时悬浮球），属特殊授权需跳系统设置',
    harmony: 'HarmonyOS 无第三方全局悬浮窗能力，已降级处理',
    action: '去设置',
  },
  {
    key: 'usage',
    icon: '📊',
    title: '使用情况访问',
    android: '检测是否打开了娱乐 App 并提醒退出（防打扰核心）',
    harmony: 'HarmonyOS 不向第三方开放该能力，防打扰以引导自控为主',
    action: '去设置',
  },
  {
    key: 'battery',
    icon: '🔋',
    title: '忽略电池优化',
    android: '降低后台被杀概率，保证番茄钟在后台持续计时',
    harmony: '配合长时任务申请使用（见设计方案 4.3）',
    action: '去设置',
  },
]

function onItem(item: (typeof ITEMS)[number]) {
  if (item.key === 'notify') {
    void permission.ensureNotifyPermission()
  } else {
    permission.goPermissionPage(item.key as 'overlay' | 'usage' | 'battery')
  }
}
</script>

<template>
  <view class="page">
    <view class="tip">
      当前平台：{{ platformName }}。说明：Android 与 HarmonyOS 对「后台运行 / 悬浮窗 /
      应用使用情况」的开放程度不同，部分能力在鸿蒙端按系统规范降级（详见设计方案 4.4）。
    </view>

    <view class="card">
      <view v-for="item in ITEMS" :key="item.key" class="row">
        <text class="icon">{{ item.icon }}</text>
        <view class="main">
          <text class="title">{{ item.title }}</text>
          <text class="desc">Android：{{ item.android }}</text>
          <text class="desc">鸿蒙：{{ item.harmony }}</text>
        </view>
        <view class="btn" @click="onItem(item)">{{ item.action }}</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.tip { font-size: 22rpx; color: $tomato-warning; background: #fff8e6; border-radius: $tomato-radius; padding: 20rpx; line-height: 1.6; }
.card { margin-top: 24rpx; background: #fff; border-radius: $tomato-radius; padding: 8rpx 24rpx; }
.row { display: flex; gap: 20rpx; align-items: flex-start; padding: 26rpx 0; border-bottom: 1rpx solid #f2f3f5; &:last-child { border-bottom: none; } }
.icon { font-size: 44rpx; }
.main { flex: 1; .title { font-size: 28rpx; font-weight: 600; } .desc { display: block; font-size: 20rpx; color: $tomato-info; margin-top: 4rpx; } }
.btn { background: #f2f3f5; color: $tomato-primary; border-radius: 999rpx; padding: 10rpx 26rpx; font-size: 22rpx; flex-shrink: 0; }
</style>
