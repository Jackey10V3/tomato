<script setup lang="ts">
/** 页面渲染出错时的提示卡：替代白屏，把错误摆出来并提供复制 */
defineProps<{ message: string }>()
const emit = defineEmits<{ (e: 'copy'): void; (e: 'dismiss'): void }>()
</script>

<template>
  <view class="page-error">
    <text class="pe-title">😵 页面渲染出错了</text>
    <text class="pe-msg">{{ message }}</text>
    <view class="pe-actions">
      <view class="pe-btn" @click="emit('copy')">复制错误</view>
      <view class="pe-btn ghost" @click="emit('dismiss')">忽略</view>
    </view>
    <text class="pe-hint">也可在「我的 - 诊断信息」查看完整错误日志</text>
  </view>
</template>

<style lang="scss" scoped>
.page-error {
  margin: 18rpx 24rpx;
  padding: 26rpx;
  border-radius: 28rpx;
  background: #fff5f4;
  border: 2rpx solid #ffd9d4;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.pe-title { font-size: 28rpx; font-weight: 800; color: #d8415d; }
.pe-msg {
  font-size: 24rpx;
  color: #8d6a70;
  line-height: 1.6;
  word-break: break-all;
  max-height: 200rpx;
  overflow: hidden;
}
.pe-actions { display: flex; gap: 16rpx; margin-top: 6rpx; }
.pe-btn {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #fff;
  background: #d8415d;
  &.ghost { background: transparent; color: #8d6a70; border: 2rpx solid #e6d4d6; }
}
.pe-hint { font-size: 22rpx; color: #a89397; }
</style>
