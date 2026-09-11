import type { WebSocket } from 'ws'

export interface PresenceMember {
  userId: string
  nickname: string
  state: 'focus' | 'break' | 'idle'
  remainSec: number
  joinedAt: number
}

interface Client {
  ws: WebSocket
  userId: string
  nickname: string
  state: PresenceMember['state']
  remainSec: number
  joinedAt: number
}

/**
 * 自习室 RoomHub：内存态房间成员表 + 广播。
 * 持久化（房间表）在 models/room.ts；弹幕落库见 models/roomMessage.ts（骨架中广播为主）。
 */
class RoomHub {
  private rooms = new Map<string, Map<string, Client>>()

  onlineCount(roomId: string): number {
    return this.rooms.get(roomId)?.size || 0
  }

  join(roomId: string, ws: WebSocket, userId: string, nickname: string): void {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map())
    const room = this.rooms.get(roomId)!
    room.set(userId, { ws, userId, nickname, state: 'idle', remainSec: 0, joinedAt: Date.now() })

    const members = this.members(roomId)
    this.send(ws, { type: 'welcome', data: { members } })
    this.broadcast(roomId, ws, {
      type: 'system',
      data: { content: `${nickname} 加入了自习室` },
    })
    this.broadcastPresence(roomId)
  }

  leave(roomId: string, ws: WebSocket): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    for (const [userId, c] of room) {
      if (c.ws === ws) {
        room.delete(userId)
        this.broadcast(roomId, null, {
          type: 'system',
          data: { content: `${c.nickname} 离开了自习室` },
        })
        this.broadcastPresence(roomId)
        if (room.size === 0) this.rooms.delete(roomId)
        return
      }
    }
  }

  handleMessage(roomId: string, ws: WebSocket, msg: unknown): void {
    const m = msg as {
      type?: string
      data?: { content?: string; state?: PresenceMember['state']; remainSec?: number }
    }
    if (!m?.type) return
    const room = this.rooms.get(roomId)
    const me = room ? [...room.values()].find(c => c.ws === ws) : undefined

    if (m.type === 'ping') {
      this.send(ws, { type: 'pong' })
      return
    }
    if (!me) return

    if (m.type === 'presence') {
      me.state = m.data?.state || 'idle'
      me.remainSec = m.data?.remainSec || 0
      this.broadcastPresence(roomId)
      return
    }
    if (m.type === 'danmaku' || m.type === 'emoji') {
      const payload = {
        type: m.type,
        data: {
          roomId,
          userId: me.userId,
          nickname: me.nickname,
          kind: m.type,
          content: String(m.data?.content || '').slice(0, 100),
          createdAt: Date.now(),
        },
      }
      this.broadcast(roomId, null, payload)
    }
  }

  private broadcastPresence(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    const members = this.members(roomId)
    const payload = { type: 'presence-list', data: { members } }
    room.forEach(c => this.send(c.ws, payload))
  }

  private members(roomId: string): PresenceMember[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    return [...room.values()].map(c => ({
      userId: c.userId,
      nickname: c.nickname,
      state: c.state,
      remainSec: c.remainSec,
      joinedAt: c.joinedAt,
    }))
  }

  private broadcast(roomId: string, except: WebSocket | null, payload: unknown): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.forEach(c => {
      if (c.ws !== except && c.ws.readyState === c.ws.OPEN) {
        this.send(c.ws, payload)
      }
    })
  }

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload))
  }
}

export const roomHub = new RoomHub()
