/** 自习室 REST 接口（实时交互走 api/ws.ts） */

import { http } from './http'
import type { Room } from '@/types/room'

export const roomApi = {
  list(): Promise<Room[]> {
    return http.get<Room[]>('/rooms')
  },
  create(payload: { name: string; maxMembers?: number }): Promise<Room> {
    return http.post<Room>('/rooms', payload)
  },
}
