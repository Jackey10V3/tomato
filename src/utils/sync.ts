/** 离线操作队列：写操作先落本地，联网后按序上报（配合增量同步使用） */

import { storage } from './storage'

const QUEUE_KEY = 'sync:outbox'

export interface OutboxItem<T = unknown> {
  id: string
  method: 'POST' | 'PUT' | 'DELETE'
  url: string
  body: T
  ts: number
}

export const outbox = {
  list(): OutboxItem[] {
    const raw = storage.get<string>(QUEUE_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as OutboxItem[]
    } catch {
      return []
    }
  },

  push<T>(item: Omit<OutboxItem<T>, 'ts'>): void {
    const items = outbox.list()
    items.push({ ...(item as OutboxItem<T>), ts: Date.now() } as OutboxItem)
    storage.set(QUEUE_KEY, JSON.stringify(items))
  },

  /** 上报成功一批后调用 */
  remove(ids: string[]): void {
    const rest = outbox.list().filter(i => !ids.includes(i.id))
    storage.set(QUEUE_KEY, JSON.stringify(rest))
  },

  clear(): void {
    storage.remove(QUEUE_KEY)
  },
}
