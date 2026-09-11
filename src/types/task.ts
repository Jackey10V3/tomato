/** 任务优先级：0无 1低 2中 3高 */
export type Priority = 0 | 1 | 2 | 3

export interface Subtask {
  id: string
  title: string
  done: boolean
}

/** 重复规则：无 / 每天 / 每周（每周在完成任务后重生成下一实例） */
export type RepeatType = 'none' | 'daily' | 'weekly'

/**
 * 清单 key：
 * - 特殊清单：'today'（今天/待办）、'inbox'（收集箱）、'future'（未来）、'done'（已完成归档视图）
 * - 自定义清单：用户创建，形如 list_<uuid>
 */
export type ListKey = 'today' | 'inbox' | 'future' | 'done' | string

export interface TaskList {
  id: ListKey
  name: string
  icon?: string
  /** 特殊清单不可删除 */
  builtin: boolean
  sortOrder: number
  createdAt: number
}

/** 本地任务（字段自洽；云端同步后续版本再接） */
export interface Task {
  _id: string
  listId: ListKey
  title: string
  notes: string
  /** 该待办的计时类型（二级页使用） */
  mode: 'countdown' | 'countup'
  /** 倒计时时长（分钟）；正向计时该字段仅作提示 */
  minutes: number
  /** 该待办的专属颜色（hex，空则按 id 自动分配） */
  color?: string
  tags: string[]
  priority: Priority
  sortOrder: number
  /** 截止/计划日期 YYYY-MM-DD */
  dueDate?: string
  /** 预计番茄数 */
  estimate: number
  /** 已完成番茄数 */
  done: number
  completed: boolean
  completedAt?: number
  subtasks: Subtask[]
  repeat: RepeatType
  deleted: boolean
  /** 由 future 提前到今天 / 由今天推迟到 future 的轨迹（未来清单用） */
  futureDate?: string
  createdAt: number
  updatedAt: number
}

export type TaskInput = Partial<Omit<Task, '_id' | 'createdAt' | 'updatedAt'>> &
  Pick<Task, 'title'>

export const BUILTIN_LISTS: TaskList[] = [
  { id: 'today', name: '今天', icon: '☀️', builtin: true, sortOrder: 0, createdAt: 0 },
  { id: 'inbox', name: '收集箱', icon: '📥', builtin: true, sortOrder: 1, createdAt: 0 },
  { id: 'future', name: '未来', icon: '🗓️', builtin: true, sortOrder: 2, createdAt: 0 },
  { id: 'done', name: '已完成', icon: '✅', builtin: true, sortOrder: 3, createdAt: 0 },
]

/** 任务详情编辑器可选择的颜色/图标清单（自定义清单用） */
export const LIST_ICONS = ['📁', '📚', '💼', '🏋️', '🎨', '🧪', '✍️', '🎯', '🧘', '🛒']
