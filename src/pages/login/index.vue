<script setup lang="ts">
/** 本地登录 / 注册（离线，数据不出本机） */
import { computed, ref } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { themeStyle, posterBg } from '@/utils/theme'

const auth = useAuthStore()
const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))

const mode = ref<'login' | 'register'>('login')
const account = ref('')
const password = ref('')
const nickname = ref('')
const showPwd = ref(false)

function submit() {
  if (!account.value.trim() || !password.value) {
    uni.showToast({ title: '请填写账号与密码', icon: 'none' })
    return
  }
  const res =
    mode.value === 'login'
      ? auth.login({ account: account.value, password: password.value })
      : auth.register({ account: account.value, password: password.value, nickname: nickname.value })
  if (!res.ok) {
    uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
    return
  }
  // 登录后把昵称同步到个性化
  if (auth.current?.nickname) settings.update({ nickname: auth.current.nickname })
  uni.showToast({ title: mode.value === 'login' ? '登录成功' : '注册成功', icon: 'success' })
  setTimeout(goBack, 600)
}
function logout() {
  auth.logout()
  uni.showToast({ title: '已退出登录', icon: 'none' })
}
</script>

<template>
  <view class="screen" :style="[style, { background: poster }]">
    <view class="t-header" :style="{ paddingTop: statusBarH + 'px' }">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">{{ auth.isLogin ? '账号' : mode === 'login' ? '登录' : '注册' }}</text>
    </view>

    <view v-if="auth.isLogin" class="card logged">
      <text class="big-avatar">🍅</text>
      <text class="nick">{{ auth.displayName }}</text>
      <text class="sub">账号：{{ auth.account }} · 本地账号（未联网）</text>
      <view class="pill logout" @click="logout"><text>退出登录</text></view>
      <text class="note">提示：数据保存在本机；换设备或重装前，请在「我的-数据管理」导出备份。</text>
    </view>

    <view v-else class="card">
      <view class="tabs">
        <view class="tab" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</view>
        <view class="tab" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</view>
      </view>

      <input v-model="account" class="ipt" placeholder="账号（字母/数字，≥3 位）" :placeholder-style="'color:#c9c2bc'" />
      <view class="pwd-row">
        <input v-model="password" class="ipt flex" :password="!showPwd" placeholder="密码（≥4 位）" :placeholder-style="'color:#c9c2bc'" />
        <text class="eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁' }}</text>
      </view>
      <input v-if="mode === 'register'" v-model="nickname" class="ipt" placeholder="昵称（可选）" :placeholder-style="'color:#c9c2bc'" />

      <view class="pill submit" @click="submit"><text>{{ mode === 'login' ? '登录' : '注册并登录' }}</text></view>
      <text class="note">本地账号仅存于本机（加盐哈希），用于区分个人档案；后续云同步会沿用该账号。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.card { background: var(--p-card, #fff); border-radius: 26rpx; margin: 20rpx 24rpx; padding: 30rpx; box-shadow: 0 8rpx 22rpx rgba(240, 100, 130, 0.07); }
.tabs { display: flex; background: var(--p-soft, #f6eef1); border-radius: 999rpx; padding: 5rpx; margin-bottom: 26rpx; }
.tab { flex: 1; text-align: center; padding: 12rpx 0; border-radius: 999rpx; font-size: 26rpx; color: var(--p-sub, #999); &.on { background: var(--p-primary, #e53935); color: #fff; font-weight: 700; } }
.ipt { background: var(--p-soft, #f7f4f5); border-radius: 16rpx; padding: 20rpx 24rpx; font-size: 28rpx; margin-bottom: 20rpx; color: var(--p-text, #333); }
.pwd-row { display: flex; align-items: center; gap: 12rpx; }
.flex { flex: 1; }
.eye { font-size: 30rpx; padding: 0 10rpx 20rpx 0; }
.submit { margin-top: 12rpx; }
.note { display: block; margin-top: 20rpx; font-size: 20rpx; color: var(--p-sub, #999); line-height: 1.7; }
.logged { display: flex; flex-direction: column; align-items: center; gap: 10rpx; padding: 50rpx 30rpx; }
.big-avatar { font-size: 110rpx; }
.nick { font-size: 36rpx; font-weight: 800; }
.sub { font-size: 22rpx; color: var(--p-sub, #999); }
.logout { margin-top: 24rpx; background: var(--p-soft, #fdecef); color: var(--p-primary, #e53935); box-shadow: none; }
</style>
