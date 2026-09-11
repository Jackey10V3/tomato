/** 专注记录接口 */

import { http } from './http'
import type { Page } from '@/types/api'

export interface FocusRecordPayload {
  kind: 'focus' | 'break'
  taskId?: string | null
  phaseRound?: number
  plannedSec?: number
  actualSec: number
  completed: boolean
  abandonedReason?: 'manual_stop' | 'give_up' | 'app_killed'
  /** 客户端本地开始时间（ms） */
  startedAt?: number
}

export interface FocusRecord {
  _id: string
  userId: string
  taskId?: string
  kind: 'focus' | 'break'
  phaseRound: number
  plannedSec: number
  actualSec: number
  completed: boolean
  startedAt: number
  endedAt: number
  createdAt: number
}

export const focusApi = {
  record(payload: FocusRecordPayload): Promise<FocusRecord> {
    return http.post<FocusRecord>('/focus-records', payload)
  },
  list(params: { page?: number; pageSize?: number } = {}): Promise<Page<FocusRecord>> {
    const query = `?page=${params.page ?? 1}&pageSize=${params.pageSize ?? 50}`
    return http.get<Page<FocusRecord>>(`/focus-records${query}`)
  },
}
