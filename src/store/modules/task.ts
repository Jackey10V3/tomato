import { defineStore } from 'pinia'
import { storage } from '@/utils/storage'
import { uuid } from '@/utils/uuid'
import {
  BUILTIN_LISTS,
  type ListKey,
  type Task,
  type TaskInput,
  type TaskList,
  type RepeatType,
  type Subtask,
} from '@/types/task'

const K_TASKS = 'task:list'
const K_LISTS = 'task:lists'

function now(): number {
  return Date.now()
}
function todayKey(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
/** 重复任务完成后的下一次日期 */
function nextRepeatDate(repeat: RepeatType): string {
  const d = new Date()
  if (repeat === 'daily') d.setDate(d.getDate() + 1)
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 首次使用可选的演示数据（仅当无任何任务时由 load() 决定不注入；用户可手动调用 seedDemo） */
export function seedTasks(): Task[] {
  const t = now()
  const mk = (listId: ListKey, title: string, extra: Partial<Task> = {}): Task => ({
    _id: uuid(),
    listId,
    title,
    notes: '',
    mode: 'countdown',
    minutes: 25,
    tags: [],
    priority: 2,
    sortOrder: 0,
    estimate: 2,
    done: 0,
    completed: false,
    subtasks: [],
    repeat: 'none',
    deleted: false,
    createdAt: t,
    updatedAt: t,
    ...extra,
  })
  return [
    mk('today', '写番茄ToDo 产品方案', {
      tags: ['工作'], priority: 3, estimate: 3, notes: '参考 Forest 与番茄ToDo 设计专注闭环',
      subtasks: [{ id: uuid(), title: '梳理功能清单', done: true }, { id: uuid(), title: '画界面草图', done: false }],
    }),
    mk('today', '读《深度工作》40 页', { tags: ['阅读'], estimate: 2, dueDate: todayKey() }),
    mk('today', '30 分钟英语听力', { tags: ['英语'], estimate: 1 }),
    mk('inbox', '给家人挑礼物 🎁', { priority: 1 }),
    mk('future', '学习 Vue3 源码', { tags: ['学习'], priority: 2, estimate: 8, dueDate: '2099-01-01' }),
    mk('inbox', '整理云盘照片', { priority: 1 }),
  ]
}

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
    customLists: [] as TaskList[],
    loaded: false,
  }),

  getters: {
    /** 特殊清单 + 自定义清单（已完成不在列表中展示） */
    lists(st): TaskList[] {
      const custom = [...st.customLists].sort((a, b) => a.sortOrder - b.sortOrder)
      const built = BUILTIN_LISTS.filter(l => l.id !== 'done')
      return [...built, ...custom]
    },
    byId(st) {
      return (id: string) => st.tasks.find(t => t._id === id)
    },
    listTasks(st) {
      return (listId: ListKey, includeDone = false) =>
        st.tasks
          .filter(t => !t.deleted && t.listId === listId && (includeDone || !t.completed))
          .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt - a.updatedAt)
    },
    doneTasks(st) {
      return st.tasks
        .filter(t => !t.deleted && t.completed)
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    },
    tags(st) {
      return [...new Set(st.tasks.filter(t => !t.deleted).flatMap(t => t.tags))].sort()
    },
  },

  actions: {
    loadLocal() {
      if (this.loaded) return
      const rawT = storage.get<string>(K_TASKS)
      const rawL = storage.get<string>(K_LISTS)
      if (rawT) {
        try {
          this.tasks = JSON.parse(rawT) as Task[]
        } catch {
          this.tasks = []
        }
      }
      if (rawL) {
        try {
          this.customLists = JSON.parse(rawL) as TaskList[]
        } catch {
          this.customLists = []
        }
      }
      this.loaded = true
    },

    /** 首次使用注入一组演示数据（在「我的-数据」可清除） */
    seedDemo() {
      this.tasks = seedTasks()
      this.customLists = []
      this.persist()
    },

    persist() {
      storage.set(K_TASKS, JSON.stringify(this.tasks))
      storage.set(K_LISTS, JSON.stringify(this.customLists))
    },

    // ---------- 清单 ----------
    createList(name: string, icon = '📁'): TaskList {
      const list: TaskList = {
        id: 'list_' + uuid(),
        name,
        icon,
        builtin: false,
        sortOrder: BUILTIN_LISTS.length + this.customLists.length,
        createdAt: now(),
      }
      this.customLists.push(list)
      this.persist()
      return list
    },
    renameList(id: string, name: string, icon?: string) {
      const l = this.customLists.find(x => x.id === id)
      if (!l) return
      if (name) l.name = name
      if (icon) l.icon = icon
      this.persist()
    },
    removeList(id: string) {
      this.customLists = this.customLists.filter(x => x.id !== id)
      // 任务移回收集箱
      this.tasks.forEach(t => {
        if (t.listId === id) t.listId = 'inbox'
      })
      this.persist()
    },

    // ---------- 任务 ----------
    addToList(listId: ListKey, input: TaskInput): Task {
      const maxSort = this.tasks
        .filter(t => t.listId === listId)
        .reduce((m, t) => Math.max(m, t.sortOrder), 0)
      const task: Task = {
        _id: uuid(),
        listId,
        title: input.title.trim(),
        notes: input.notes || '',
        mode: input.mode ?? 'countdown',
        minutes: input.minutes ?? 25,
        color: input.color,
        tags: input.tags || [],
        priority: input.priority ?? 0,
        sortOrder: maxSort + 1,
        dueDate: input.dueDate,
        estimate: input.estimate ?? 1,
        done: input.done ?? 0,
        completed: input.completed ?? false,
        completedAt: input.completed ? now() : undefined,
        subtasks: input.subtasks || [],
        repeat: input.repeat || 'none',
        deleted: false,
        futureDate: input.futureDate,
        createdAt: now(),
        updatedAt: now(),
      }
      this.tasks.push(task)
      this.persist()
      return task
    },

    update(id: string, patch: Partial<Task>) {
      const t = this.byId(id)
      if (!t) return
      Object.assign(t, patch, { updatedAt: now() })
      if (patch.completed !== undefined) {
        t.completedAt = patch.completed ? now() : undefined
      }
      this.persist()
    },

    toggle(id: string) {
      const t = this.byId(id)
      if (!t || t.deleted) return
      const completing = !t.completed
      t.completed = completing
      t.completedAt = completing ? now() : undefined
      t.updatedAt = now()
      if (completing && t.repeat !== 'none') {
        // 重复任务：原任务归档，生成下一实例
        const next = this.addToList(t.listId, {
          title: t.title,
          notes: t.notes,
          tags: t.tags,
          priority: t.priority,
          estimate: t.estimate,
          subtasks: [],
          repeat: t.repeat,
        })
        next.dueDate = nextRepeatDate(t.repeat)
        next.sortOrder = t.sortOrder + 0.5
        this.persist()
      } else {
        this.persist()
      }
    },

    remove(id: string) {
      const t = this.byId(id)
      if (t) {
        t.deleted = true
        t.updatedAt = now()
        this.persist()
      }
    },

    moveToList(id: string, listId: ListKey, futureDate?: string) {
      const t = this.byId(id)
      if (!t) return
      t.listId = listId
      t.futureDate = futureDate
      t.updatedAt = now()
      this.persist()
    },
    /** 推迟到未来清单 */
    delayToFuture(id: string) {
      const t = this.byId(id)
      if (!t) return
      this.moveToList(id, 'future', t.dueDate || todayKey())
    },
    /** 从未来/收集箱带回今天 */
    bringToToday(id: string) {
      this.moveToList(id, 'today')
    },

    incDone(id: string) {
      const t = this.byId(id)
      if (!t) return
      t.done = Math.min(t.estimate || 999, t.done + 1)
      t.updatedAt = now()
      this.persist()
    },

    // ---------- 子任务 ----------
    addSubtask(id: string, title: string) {
      const t = this.byId(id)
      if (!t) return
      t.subtasks.push({ id: uuid(), title, done: false })
      t.updatedAt = now()
      this.persist()
    },
    toggleSubtask(taskId: string, subId: string) {
      const t = this.byId(taskId)
      if (!t) return
      const s = t.subtasks.find(x => x.id === subId)
      if (s) {
        s.done = !s.done
        t.updatedAt = now()
        this.persist()
      }
    },
    removeSubtask(taskId: string, subId: string) {
      const t = this.byId(taskId)
      if (!t) return
      t.subtasks = t.subtasks.filter(x => x.id !== subId)
      t.updatedAt = now()
      this.persist()
    },

    clearDone() {
      this.tasks = this.tasks.filter(t => t.deleted || !t.completed)
      this.persist()
    },
    clearAll() {
      this.tasks = []
      this.customLists = []
      this.persist()
    },

    // ---------- 备份 / 恢复 ----------
    exportAll() {
      return { tasks: this.tasks, lists: this.customLists }
    },
    importAll(data: { tasks?: Task[]; lists?: TaskList[] }) {
      if (Array.isArray(data.tasks)) this.tasks = data.tasks
      if (Array.isArray(data.lists)) this.customLists = data.lists
      this.loaded = true
      this.persist()
    },
  },
})
