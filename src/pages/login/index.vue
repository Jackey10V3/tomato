<script setup lang="ts">
/** 本地登录 / 注册（离线，数据不出本机） */
import { computed, ref } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { useSettingsStore } from '@/store/modules/settings'
import { useChrome } from '@/composables/usePageChrome'
import { useResponsive } from '@/composables/useResponsive'
import { themeStyle, posterBg } from '@/utils/theme'

const auth = useAuthStore()
const settings = useSettingsStore()
const { statusBarH, goBack } = useChrome()
const { layoutClass } = useResponsive()
const style = computed(() => themeStyle(settings.s.theme, settings.s.dark))
const poster = computed(() => posterBg(settings.s.poster))

const mode = ref<'login' | 'register'>('login')
const account = ref('')
const password = ref('')
const nickname = ref('')
const showPwd = ref(false)
const syncing = ref(false)

async function submit() {
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

  // 本地登录成功后，再换取服务端 token（云端功能如自习室/云同步依赖它）
  syncing.value = true
  const srv = await auth.syncServer(password.value)
  syncing.value = false
  if (srv.ok) {
    uni.showToast({ title: '登录成功 · 已连接云端', icon: 'success' })
  } else {
    // 不阻断本地使用：离线也能用，只是云端功能不可用
    uni.showToast({ title: `本地登录成功（${srv.msg || '云端未连接'}）`, icon: 'none', duration: 2200 })
  }
  setTimeout(goBack, 900)
}
function logout() {
  auth.logout()
  uni.showToast({ title: '已退出登录', icon: 'none' })
}
/** 手动重试云端连接（此前服务器没启动时用过） */
async function retryServer() {
  if (!password.value) {
    uni.showToast({ title: '请先在下方输入密码再重试', icon: 'none' })
    return
  }
  syncing.value = true
  const r = await auth.syncServer(password.value)
  syncing.value = false
  uni.showToast({ title: r.ok ? '已连接云端' : r.msg || '连接失败', icon: 'none' })
}
</script>

<template>
  <view class="screen" :class="layoutClass" :style="[style, { background: poster }]">
    <view class="t-header" :style="{ paddingTop: statusBarH + 'px' }">
      <text class="t-back" @click="goBack">←</text>
      <text class="t-title">{{ auth.isLogin ? '账号' : mode === 'login' ? '登录' : '注册' }}</text>
    </view>

    <view v-if="auth.isLogin" class="card logged">
      <text class="big-avatar">🍅</text>
      <text class="nick">{{ auth.displayName }}</text>
      <text class="sub">账号：{{ auth.account }}</text>
      <view class="srv" :class="{ ok: auth.serverReady }">
        <text class="dot" />
        <text>{{ auth.serverReady ? '云端已连接' : '仅本地登录 · 云端未连接' }}</text>
      </view>
      <view v-if="!auth.serverReady" class="pill retry" @click="retryServer">
        <text>{{ syncing ? '连接中…' : '输入密码后重连云端' }}</text>
      </view>
      <input v-if="!auth.serverReady" v-model="password" class="ipt" :password="!showPwd" placeholder="输入密码以重连云端" :placeholder-style="'color:#c9c2bc'" />
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
        <input v-model="password" class="ipt flex" :password="!showPwd" placeholder="密码（≥6 位）" :placeholder-style="'color:#c9c2bc'" />
        <text class="eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁' }}</text>
      </view>
      <input v-if="mode === 'register'" v-model="nickname" class="ipt" placeholder="昵称（可选）" :placeholder-style="'color:#c9c2bc'" />

      <view class="pill submit" :class="{ disabled: syncing }" @click="submit">
        <text>{{ syncing ? '连接云端中…' : mode === 'login' ? '登录' : '注册并登录' }}</text>
      </view>
      <text class="note">本地账号仅存于本机（加盐哈希）；登录时会同时连接云端（失败不影响本地使用，可在本页重连）。</text>
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
.note { display: block; margin-top: 20rpx; font-size: 22rpx; color: var(--p-sub, #999); line-height: 1.7; }
.logged { display: flex; flex-direction: column; align-items: center; gap: 10rpx; padding: 50rpx 30rpx; }
.big-avatar { font-size: 110rpx; }
.nick { font-size: 36rpx; font-weight: 800; }
.sub { font-size: 22rpx; color: var(--p-sub, #999); }
.logout { margin-top: 24rpx; background: var(--p-soft, #fdecef); color: var(--p-primary, #e53935); box-shadow: none; }
.retry { margin-top: 16rpx; background: var(--p-grad, var(--p-primary, #e53935)); }
/* 云端连接状态：灰色＝仅本地，绿色＝已连接 */
.srv { display: flex; align-items: center; gap: 10rpx; font-size: 22rpx; color: var(--p-sub, #999); }
.srv .dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #c9c2bc; }
.srv.ok { color: #43a047; }
.srv.ok .dot { background: #43a047; }
</style>
