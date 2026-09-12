/**
 * 云端数据同步（v1：union + LWW，服务端接口天生为离线同步设计）。
 *
 * 工作方式：
 * - 任务：POST /tasks 按 clientId（= 本地 _id）幂等 upsert，服务端按 updatedAt 做
 *   LWW 裁决 → 推送是幂等的，随便重推；拉取后按 clientId 对账，谁新听谁的。
 * - 专注记录：只增不改。用「已上云 _id 集合」+「指纹(kind|startedAt|actualSec)」
 *   双重去重，失败的下次 syncNow 自动补传（天然离线 outbox）。
 *
 * 已知取舍（v1）：
 * - 两台设备首次互相合并时，各自的同题任务会各留一份（不同 clientId 无法可靠判定
 *   是同一条），手动删掉一份即可，删除会同步到云端和另一台设备。
 * - mode/minutes/color/subtasks 等纯本地展示字段不在云端模型里，不同步。
 */
import { storage } from '@/utils/storage'
import { http } from '@/api/http'
import { uuid } from '@/utils/uuid'
import { dateKey } from '@/utils/date'
import { useTaskStore } from '@/store/modules/task'
import { useFocusStore } from '@/store/modules/focus'
import type { Task } from '@/types/task'
import type { FocusRecord } from '@/types/focus'

const K_PUSHED = 'cloud:pushed-record-ids'
const K_LAST_SYNC = 'cloud:last-sync-at'
/** 计划同步的最小间隔（防抖；登录触发的可越过） */
const MIN_GAP_MS = 60 * 1000

let syncing = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function cloudEnabled(): boolean {
  return !!storage.get<string>('auth:token')
}

function pushedSet(): Set<string> {
  try {
    return new Set(JSON.parse(storage.get<string>(K_PUSHED) || '[]') as string[])
  } catch {
    return new Set()
  }
}
function savePushed(set: Set<string>) {
  storage.set(K_PUSHED, JSON.stringify([...set]))
}

export function scheduleSync(delayMs = 1500, force = false) {
  if (!cloudEnabled()) return
  if (!force) {
    const last = Number(storage.get<string>(K_LAST_SYNC) || 0)
    if (Date.now() - last < MIN_GAP_MS) return
  }
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void syncNow('scheduled'), delayMs)
}

/** 手动/登录后的立即同步（无视节流） */
export async function syncNow(reason = 'manual'): Promise<{ ok: boolean; msg: string }> {
  if (syncing) return { ok: false, msg: '上一次同步还没跑完' }
  if (!cloudEnabled()) return { ok: false, msg: '未连接云端' }
  syncing = true
  try {
    await syncTasks()
    await syncFocusRecords()
    storage.set(K_LAST_SYNC, String(Date.now()))
    return { ok: true, msg: reason }
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) }
  } finally {
    syncing = false
  }
}

/* ---------------- 任务同步 ---------------- */

function taskToCloud(t: Task) {
  return {
    clientId: t._id,
    title: t.title,
    notes: t.notes,
    tags: t.tags,
    priority: t.priority,
    sortOrder: t.sortOrder,
    planDate: t.dueDate || undefined,
    estimatePomodoros: t.estimate,
    donePomodoros: t.done,
    completed: t.completed,
    completedAt: t.completedAt,
    deleted: t.deleted,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

async function syncTasks(): Promise<void> {
  const taskStore = useTaskStore()
  // 1) 拉取云端全量（v1 数据量 < 500，不做增量游标）
  const serverDocs = await http.get<
    {
      clientId: string
      title: string
      notes?: string
      tags?: string[]
      priority?: number
      sortOrder?: number
      planDate?: string
      estimatePomodoros?: number
      donePomodoros?: number
      completed?: boolean
      completedAt?: string | Date | null
      deleted?: boolean
      createdAt?: string | Date
      updatedAt?: string | Date
    }[]
  >('/tasks')

  const toPush: Task[] = []
  for (const s of serverDocs) {
    const sUpd = s.updatedAt ? new Date(s.updatedAt).getTime() : 0
    const local = taskStore.tasks.find(t => t._id === s.clientId)
    if (!local) {
      if (s.deleted) continue // 云端已删、本地没有：无需复活
      taskStore.tasks.push({
        _id: s.clientId,
        listId: 'inbox',
        title: s.title || '未命名',
        notes: s.notes || '',
        mode: 'countdown',
        minutes: 25,
        tags: s.tags || [],
        priority: (s.priority ?? 0) as Task['priority'],
        sortOrder: s.sortOrder ?? 0,
        dueDate: s.planDate,
        estimate: s.estimatePomodoros ?? 0,
        done: s.donePomodoros ?? 0,
        completed: !!s.completed,
        completedAt: s.completedAt ? new Date(s.completedAt).getTime() : undefined,
        subtasks: [],
        repeat: 'none',
        deleted: !!s.deleted,
        createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
        updatedAt: sUpd || Date.now(),
      })
    } else if (sUpd > (local.updatedAt || 0)) {
      // 云端较新 → 采纳
      local.title = s.title ?? local.title
      local.notes = s.notes ?? local.notes
      local.tags = s.tags ?? local.tags
      local.priority = (s.priority ?? local.priority) as Task['priority']
      local.sortOrder = s.sortOrder ?? local.sortOrder
      local.dueDate = s.planDate ?? local.dueDate
      local.estimate = s.estimatePomodoros ?? local.estimate
      local.done = s.donePomodoros ?? local.done
      local.completed = s.completed ?? local.completed
      local.completedAt = s.completedAt ? new Date(s.completedAt).getTime() : local.completedAt
      local.deleted = s.deleted ?? local.deleted
      local.updatedAt = sUpd
    } else if ((local.updatedAt || 0) > sUpd) {
      toPush.push(local) // 本地较新 → 回推
    }
  }
  // 2) 推送：本地较新的 + 云端没有的（POST 按 clientId 幂等，重复推无害）
  const cloudIds = new Set(serverDocs.map(s => s.clientId))
  for (const t of taskStore.tasks) {
    if (!cloudIds.has(t._id) || toPush.includes(t)) toPush.push(t)
  }
  for (const t of toPush) {
    try {
      await http.post('/tasks', taskToCloud(t), { loading: false })
    } catch {
      /* 本轮失败，下轮 syncNow 幂等补推 */
    }
  }
  taskStore.persist()
}

/* ---------------- 专注记录同步 ---------------- */

const fp = (kind: string, startedAt: number, actualSec: number) => `${kind}|${Math.floor(startedAt / 1000)}|${actualSec}`

function localToCloud(r: FocusRecord) {
  const abandonedReason =
    r.result === 'manual' ? 'manual_stop' : r.result === 'giveup' ? 'give_up' : r.result === 'abandoned' ? 'app_killed' : undefined
  return {
    kind: r.kind === 'focus' ? 'focus' : 'break',
    plannedSec: r.plannedSec,
    actualSec: r.actualSec,
    completed: r.result === 'completed' || r.result === 'manual',
    abandonedReason,
    startedAt: r.startedAt,
  }
}

function serverToLocal(s: {
  kind?: string
  phaseRound?: number
  plannedSec?: number
  actualSec?: number
  completed?: boolean
  abandonedReason?: string | null
  startedAt?: string | Date
  endedAt?: string | Date
}): FocusRecord {
  const startedAt = s.startedAt ? new Date(s.startedAt).getTime() : Date.now()
  const endedAt = s.endedAt ? new Date(s.endedAt).getTime() : startedAt + (s.actualSec || 0) * 1000
  const result =
    s.completed === false ? (s.abandonedReason === 'give_up' ? 'giveup' : s.abandonedReason === 'manual_stop' ? 'manual' : 'abandoned') : 'completed'
  return {
    _id: uuid(),
    kind: s.kind === 'break' ? 'shortBreak' : 'focus',
    mode: 'countdown',
    plannedSec: s.plannedSec || 0,
    actualSec: s.actualSec || 0,
    result: result as FocusRecord['result'],
    strict: false,
    studyHard: false,
    leaveTimes: 0,
    dateKey: dateKey(new Date(startedAt)),
    startedAt,
    endedAt,
    createdAt: startedAt,
  }
}

async function syncFocusRecords(): Promise<void> {
  const focusStore = useFocusStore()
  const pushed = pushedSet()

  // 1) 拉取云端（分页，最多取 500 条）
  const pageData: {
    kind?: string
    phaseRound?: number
    plannedSec?: number
    actualSec?: number
    completed?: boolean
    abandonedReason?: string | null
    startedAt?: string | Date
    endedAt?: string | Date
  }[] = []
  const pageSize = 200
  for (let page = 1; page <= 5; page++) {
    const r = await http.get<{ list: typeof pageData; total: number }>(`/focus-records?page=${page}&pageSize=${pageSize}`)
    pageData.push(...(r.list || []))
    if (pageData.length >= (r.total || 0)) break
  }
  const cloudFps = new Set(pageData.map(s => fp(s.kind || 'focus', s.startedAt ? new Date(s.startedAt).getTime() : 0, s.actualSec || 0)))
  let added = 0
  for (const s of pageData) {
    const local = focusStore.records.find(r => fp(r.kind === 'focus' ? 'focus' : 'break', r.startedAt, r.actualSec) === fp(s.kind || 'focus', s.startedAt ? new Date(s.startedAt).getTime() : 0, s.actualSec || 0))
    if (local) continue // 两边都有
    focusStore.records.push(serverToLocal(s))
    added++
  }

  // 2) 推送：本地没上过云、且云端没有同指纹的记录
  const localFps = new Set(focusStore.records.map(r => fp(r.kind === 'focus' ? 'focus' : 'break', r.startedAt, r.actualSec)))
  for (const r of focusStore.records) {
    if (pushed.has(r._id)) continue
    if (cloudFps.has(fp(r.kind === 'focus' ? 'focus' : 'break', r.startedAt, r.actualSec))) {
      pushed.add(r._id) // 云端已有同指纹（另一设备传的同一番茄），标记免重推
      continue
    }
    if (!localFps.has(fp(r.kind === 'focus' ? 'focus' : 'break', r.startedAt, r.actualSec))) continue
    try {
      await http.post('/focus-records', localToCloud(r), { loading: false })
      pushed.add(r._id)
    } catch {
      /* 失败不标记 → 下轮补传（天然 outbox） */
    }
  }
  savePushed(pushed)
  if (added > 0) focusStore.persist()
}
