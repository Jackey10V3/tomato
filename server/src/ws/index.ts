import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'
import { roomHub } from './roomHub'

/**
 * WebSocket 挂载：仅接管 /ws/room/:roomId 路径的升级请求。
 * 身份：优先解析 token（query ?token=），失败则作为游客加入（骨架便于本地联调）。
 */
export function attachWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url || '/', 'http://localhost')
    const match = pathname.match(/^\/ws\/room\/([^/]+)$/)
    if (!match) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req, match[1], searchParams.get('token') || '')
    })
  })

  wss.on('connection', (ws: WebSocket, _req, roomId: string, token: string) => {
    let userId = `guest-${Math.random().toString(36).slice(2, 8)}`
    let nickname = `游客${userId.slice(-4)}`
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { uid: string; nickname?: string }
      if (payload.uid) {
        userId = payload.uid
        nickname = payload.nickname || '番茄同学'
      }
    } catch {
      /* 游客模式 */
    }

    roomHub.join(roomId, ws, userId, nickname)
    ws.on('message', data => {
      try {
        roomHub.handleMessage(roomId, ws, JSON.parse(data.toString()))
      } catch {
        /* 忽略非法消息 */
      }
    })
    ws.on('close', () => roomHub.leave(roomId, ws))
    ws.on('error', () => roomHub.leave(roomId, ws))
  })
}
