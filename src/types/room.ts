/** 自习室成员状态 */
export type MemberState = 'focus' | 'break' | 'idle'

export interface RoomMember {
  userId: string
  nickname: string
  state: MemberState
  /** 状态剩余秒数（专注/休息中展示用） */
  remainSec: number
  joinedAt: number
}

export interface Room {
  _id: string
  name: string
  cover?: string
  ownerId: string
  maxMembers: number
  status: 'open' | 'closed'
  /** 在线人数：实时统计（RoomHub 维护），非持久化字段 */
  onlineCount: number
  createdAt: number
}

export type RoomMessageKind = 'danmaku' | 'emoji' | 'system'

export interface RoomMessage {
  roomId: string
  userId: string
  nickname?: string
  kind: RoomMessageKind
  content: string
  createdAt: number
}

/** 服务端与客户端约定的 WS 消息协议 */
export interface RoomWsMessage {
  type: 'presence' | 'presence-list' | 'danmaku' | 'emoji' | 'system' | 'welcome' | 'ping' | 'pong'
  roomId?: string
  data?: unknown
}
