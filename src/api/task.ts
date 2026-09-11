/** 任务接口（增量同步：服务端按 updatedAt > since 返回） */

import { http } from './http'
import type { Task } from '@/types/task'

export const taskApi = {
  /** 拉取（增量）任务列表 */
  list(since?: number): Promise<Task[]> {
    const query = since ? `?since=${since}` : ''
    return http.get<Task[]>(`/tasks${query}`)
  },
  create(task: Partial<Task>): Promise<Task> {
    return http.post<Task>('/tasks', task)
  },
  update(id: string, patch: Partial<Task>): Promise<Task> {
    return http.put<Task>(`/tasks/${id}`, patch)
  },
  /** 软删除（置 deleted = true，同步友好） */
  remove(id: string): Promise<{ ok: boolean }> {
    return http.del<{ ok: boolean }>(`/tasks/${id}`)
  },
}
