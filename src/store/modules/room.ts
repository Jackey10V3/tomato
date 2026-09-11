import { defineStore } from 'pinia'
import { roomApi } from '@/api/room'
import { WsClient } from '@/api/ws'
import type { Room, RoomMember, RoomMessage, RoomWsMessage } from '@/types/room'

/** 单例 WS 客户端（模块级，避免被 Pinia 的 reactive 代理包裹） */
let roomWs: WsClient | null = null
function ws(): WsClient {
  if (!roomWs) roomWs = new WsClient()
  return roomWs
}

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [] as Room[],
    members: [] as RoomMember[],
    messages: [] as RoomMessage[],
    currentRoomId: '',
    wsConnected: false,
  }),

  getters: {
    onlineCount: s => s.members.length,
    membersByState: s => (state: RoomMember['state']) => s.members.filter(m => m.state === state),
  },

  actions: {
    async loadRooms() {
      try {
        this.rooms = await roomApi.list()
      } catch (e) {
        console.warn('[room] loadRooms failed', e)
        // 后端未就绪时的演示数据
        this.rooms = [
          { _id: 'demo-1', name: '晨间深度专注', ownerId: '', maxMembers: 50, status: 'open', onlineCount: 12, createdAt: Date.now() },
          { _id: 'demo-2', name: '图书馆自习室', ownerId: '', maxMembers: 50, status: 'open', onlineCount: 8, createdAt: Date.now() },
        ]
      }
    },

    async createRoom(name: string) {
      const room = await roomApi.create({ name })
      this.rooms.unshift(room)
      return room
    },

    join(roomId: string) {
      this.currentRoomId = roomId
      this.members = []
      this.messages = []
      ws().clearListeners()
      ws().onStatus(connected => (this.wsConnected = connected))
      ws().onMessage(msg => this.handleMessage(msg))
      ws().connect(roomId)
    },

    leave() {
      ws().close()
      this.currentRoomId = ''
      this.members = []
      this.messages = []
      this.wsConnected = false
    },

    sendDanmaku(content: string) {
      if (!content.trim()) return
      ws().send({ type: 'danmaku', roomId: this.currentRoomId, data: { content } })
    },

    sendEmoji(emoji: string) {
      ws().send({ type: 'emoji', roomId: this.currentRoomId, data: { content: emoji } })
    },

    /** 上报自身状态（专注中/休息中/空闲） */
    setMyState(state: RoomMember['state'], remainSec = 0) {
      ws().send({ type: 'presence', roomId: this.currentRoomId, data: { state, remainSec } })
    },

    handleMessage(msg: RoomWsMessage) {
      switch (msg.type) {
        case 'welcome': {
          const data = msg.data as { members?: RoomMember[] }
          this.members = data?.members ?? []
          break
        }
        case 'presence': {
          const data = msg.data as RoomMember
          if (!data?.userId) break
          const i = this.members.findIndex(m => m.userId === data.userId)
          if (i >= 0) this.members.splice(i, 1, data)
          else this.members.push(data)
          break
        }
        // 服务端在成员加入/离开/状态变更时广播整份名单，覆盖式更新
        case 'presence-list': {
          const data = msg.data as { members?: RoomMember[] }
          this.members = data?.members ?? []
          break
        }
        case 'danmaku':
        case 'emoji': {
          const data = msg.data as RoomMessage
          if (data) this.messages.push(data)
          break
        }
        case 'system': {
          const data = msg.data as { content?: string }
          if (data?.content) {
            this.messages.push({
              roomId: this.currentRoomId,
              userId: 'system',
              kind: 'system',
              content: data.content,
              createdAt: Date.now(),
            })
          }
          break
        }
        default:
          break
      }
    },
  },
})
