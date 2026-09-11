/**
 * WebSocket 客户端封装（uni.connectSocket）。
 * 连接 / 自动重连 / 心跳 / 统一消息分发。用于自习室实时互动。
 */

import { storage } from '@/utils/storage'
import type { RoomWsMessage } from '@/types/room'
import { BASE_URL } from './http'

type MsgHandler = (msg: RoomWsMessage) => void
type StatusHandler = (connected: boolean) => void

function wsBase(): string {
  const env = import.meta.env.VITE_WS_BASE as string | undefined
  if (env) return env
  return BASE_URL.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '')
}

export class WsClient {
  private url = ''
  private task: UniApp.SocketTask | null = null
  private connected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private manualClose = false
  private reconnectDelay = 3000
  private handlers = new Set<MsgHandler>()
  private statusHandlers = new Set<StatusHandler>()

  onMessage(fn: MsgHandler): () => void {
    this.handlers.add(fn)
    return () => this.handlers.delete(fn)
  }
  onStatus(fn: StatusHandler): () => void {
    this.statusHandlers.add(fn)
    return () => this.statusHandlers.delete(fn)
  }

  /** 清空消息/状态监听（重新加入房间前调用，避免旧回调累积） */
  clearListeners() {
    this.handlers.clear()
    this.statusHandlers.clear()
  }

  connect(roomId: string) {
    this.manualClose = false
    this.url = `${wsBase()}/ws/room/${roomId}?token=${encodeURIComponent(storage.get<string>('auth:token') || '')}`
    this.open()
  }

  private open() {
    if (this.task || this.manualClose) return
    const task = uni.connectSocket({ url: this.url, complete: () => undefined })
    this.task = task

    task.onOpen(() => {
      this.connected = true
      this.emitStatus(true)
      this.startHeartbeat()
    })
    task.onMessage(res => {
      try {
        const msg = JSON.parse(res.data as string) as RoomWsMessage
        this.handlers.forEach(fn => fn(msg))
      } catch {
        /* 忽略非 JSON 消息 */
      }
    })
    task.onClose(() => {
      this.connected = false
      this.task = null
      this.stopHeartbeat()
      this.emitStatus(false)
      this.scheduleReconnect()
    })
    task.onError(() => {
      this.connected = false
      this.task = null
      this.stopHeartbeat()
      this.emitStatus(false)
      this.scheduleReconnect()
    })
  }

  send(payload: RoomWsMessage) {
    if (this.task && this.connected) {
      this.task.send({ data: JSON.stringify(payload) })
    }
  }

  close() {
    this.manualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    this.task?.close({})
    this.task = null
    this.connected = false
  }

  private scheduleReconnect() {
    if (this.manualClose || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.manualClose) this.open()
    }, this.reconnectDelay)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' })
    }, 20000)
  }
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
  private emitStatus(connected: boolean) {
    this.statusHandlers.forEach(fn => fn(connected))
  }
}
