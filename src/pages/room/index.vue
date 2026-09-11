<script setup lang="ts">
/**
 * 自习室房间列表
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useRoomStore } from '@/store/modules/room'
import { useUserStore } from '@/store/modules/user'

const roomStore = useRoomStore()
const userStore = useUserStore()
const roomName = ref('')

function enter(roomId: string) {
  if (!userStore.isLogin) {
    uni.showToast({ title: '请先登录后加入自习室', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/room/detail?id=${roomId}` })
}

function createRoom() {
  const name = roomName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入房间名', icon: 'none' })
    return
  }
  roomStore
    .createRoom(name)
    .then(room => {
      roomName.value = ''
      enter(room._id)
    })
    .catch(() => uni.showToast({ title: '创建失败，请检查后端服务', icon: 'none' }))
}

onShow(() => {
  roomStore.loadRooms()
})
</script>

<template>
  <view class="page">
    <view class="create">
      <input v-model="roomName" class="ipt" placeholder="创建房间：晨间自习" @confirm="createRoom" />
      <view class="btn" @click="createRoom">创建</view>
    </view>

    <view v-if="roomStore.rooms.length" class="rooms">
      <view v-for="r in roomStore.rooms" :key="r._id" class="room" @click="enter(r._id)">
        <view class="room-main">
          <text class="room-name">🏠 {{ r.name }}</text>
          <text class="room-sub">上限 {{ r.maxMembers }} 人</text>
        </view>
        <view class="online">
          <text class="dot" />
          <text>{{ r.onlineCount || 0 }} 人在线</text>
        </view>
      </view>
    </view>
    <view v-else class="empty">加载中 / 暂无房间，创建第一个吧</view>
  </view>
</template>

<style lang="scss" scoped>
.page { padding: 24rpx; min-height: 100vh; }
.create {
  display: flex;
  gap: 16rpx;
  .ipt {
    flex: 1;
    background: #fff;
    border-radius: $tomato-radius;
    padding: 18rpx 24rpx;
  }
  .btn { background: $tomato-primary; color: #fff; border-radius: $tomato-radius; padding: 18rpx 32rpx; font-size: 26rpx; }
}
.rooms { margin-top: 24rpx; }
.room {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: $tomato-radius;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  .room-name { font-size: 30rpx; font-weight: 600; }
  .room-sub { display: block; margin-top: 6rpx; font-size: 22rpx; color: $tomato-info; }
  .online { display: flex; align-items: center; gap: 8rpx; font-size: 24rpx; color: $tomato-success; }
  .dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $tomato-success; }
}
.empty { text-align: center; color: #999; margin-top: 200rpx; font-size: 26rpx; }
</style>
