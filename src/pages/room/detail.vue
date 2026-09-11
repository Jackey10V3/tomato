<script setup lang="ts">
/**
 * 自习室房间页：presence + 弹幕/表情
 */
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import RoomStatusBar from '@/components/RoomStatusBar.vue'
import { useRoomStore } from '@/store/modules/room'

const roomStore = useRoomStore()
const text = ref('')
const roomId = ref('')
const EMOJIS = ['🔥', '💪', '🎉', '🍅', '☕', '😴']

onLoad(query => {
  roomId.value = query?.id || ''
  if (roomId.value) roomStore.join(roomId.value)
})

onUnload(() => {
  roomStore.leave()
})

function send() {
  const content = text.value.trim()
  if (!content) return
  roomStore.sendDanmaku(content)
  text.value = ''
}

function setState(state: 'focus' | 'break' | 'idle') {
  roomStore.setMyState(state, state === 'idle' ? 0 : 25 * 60)
  uni.showToast({ title: state === 'focus' ? '已标记：专注中' : state === 'break' ? '已标记：休息中' : '已标记：空闲', icon: 'none' })
}
</script>

<template>
  <view class="page">
    <view class="conn" :class="{ on: roomStore.wsConnected }">
      {{ roomStore.wsConnected ? '● 已连接' : '○ 连接中/离线（请启动后端 server）' }}
    </view>

    <RoomStatusBar :members="roomStore.members" />

    <view class="my-state">
      <text class="label">我的状态：</text>
      <view class="btn sm" @click="setState('focus')">🍅 专注中</view>
      <view class="btn sm" @click="setState('break')">☕ 休息中</view>
      <view class="btn sm" @click="setState('idle')">💤 空闲</view>
    </view>

    <view class="msgs">
      <view v-for="(m, i) in roomStore.messages" :key="i" class="msg" :class="m.kind">
        <text v-if="m.kind === 'system'" class="sys">{{ m.content }}</text>
        <template v-else>
          <text class="who">{{ m.nickname || '同学' }}：</text>
          <text>{{ m.content }}</text>
        </template>
      </view>
      <view v-if="!roomStore.messages.length" class="no-msg">暂无消息，发条弹幕互相打气吧～</view>
    </view>

    <view class="emojis">
      <text v-for="e in EMOJIS" :key="e" class="emoji" @click="roomStore.sendEmoji(e)">{{ e }}</text>
    </view>

    <view class="send">
      <input v-model="text" class="ipt" confirm-type="send" placeholder="发条弹幕…" @confirm="send" />
      <view class="btn" @click="send">发送</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { padding: 24rpx; padding-bottom: 40rpx; min-height: 100vh; display: flex; flex-direction: column; }
.conn { font-size: 20rpx; color: #bbb; margin-bottom: 12rpx; &.on { color: $tomato-success; } }
.my-state {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  .label { font-size: 24rpx; color: $tomato-info; }
}
.btn {
  background: $tomato-primary;
  color: #fff;
  border-radius: $tomato-radius;
  padding: 16rpx 28rpx;
  font-size: 24rpx;
  &.sm { background: #fff; color: $tomato-text-main; border: 1rpx solid #e5e6eb; }
}
.msgs {
  flex: 1;
  margin-top: 20rpx;
  background: #fff;
  border-radius: $tomato-radius;
  padding: 20rpx;
  min-height: 300rpx;
  overflow-y: auto;
  .msg { font-size: 26rpx; margin-bottom: 14rpx; .who { color: $tomato-info; } }
  .msg.system .sys { color: #bbb; font-size: 22rpx; }
  .no-msg { color: #bbb; text-align: center; margin-top: 120rpx; }
}
.emojis { display: flex; gap: 16rpx; margin-top: 16rpx; .emoji { font-size: 40rpx; } }
.send { display: flex; gap: 16rpx; margin-top: 16rpx; .ipt { flex: 1; background: #fff; border-radius: 999rpx; padding: 16rpx 24rpx; } }
</style>
