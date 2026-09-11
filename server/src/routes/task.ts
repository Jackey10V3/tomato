import { Router, type Request, type Response } from 'express'
import { Task } from '../models/task'
import { err, ok } from '../config/env'
import { json } from '../config/db'
import { auth } from '../middleware/auth'
import type { AuthInfo } from '../middleware/auth'

export const taskRouter = Router()

function userId(req: Request): string {
  return (req.auth as AuthInfo).uid
}

// GET /tasks?since=1234567890 —— 增量拉取（LWW 同步游标）
taskRouter.get('/', auth(), async (req: Request, res: Response) => {
  const since = Number(req.query.since) || 0
  const filter: Record<string, unknown> = { userId: userId(req) }
  if (since) filter.updatedAt = { $gt: new Date(since) }
  const docs = await Task.find(filter).sort({ updatedAt: 1 }).limit(500)
  res.json(ok(docs.map(json)))
})

// POST /tasks —— 按 clientId 幂等创建/更新（离线创建去重）
taskRouter.post('/', auth(), async (req: Request, res: Response) => {
  const uid = userId(req)
  const body = (req.body || {}) as Record<string, unknown>
  if (!body.clientId) {
    res.status(400).json(err(400, '缺少 clientId'))
    return
  }
  const incoming = { ...body, userId: uid }
  let task = await Task.findOne({ userId: uid, clientId: body.clientId })
  if (!task) {
    task = new Task({
      userId: uid,
      clientId: body.clientId,
      title: body.title || '未命名',
      notes: body.notes || '',
      tags: body.tags || [],
      priority: body.priority ?? 0,
      sortOrder: body.sortOrder ?? 0,
      planDate: body.planDate,
      estimatePomodoros: body.estimatePomodoros ?? 0,
      donePomodoros: body.donePomodoros ?? 0,
      completed: body.completed ?? false,
      completedAt: body.completedAt ? new Date(body.completedAt as number) : undefined,
      deleted: body.deleted ?? false,
    })
  } else {
    // LWW：服务端保留较新的 updatedAt
    const clientTs = Number(body.updatedAt) || 0
    if (clientTs < task.updatedAt.getTime()) {
      res.json(ok(json(task)))
      return
    }
    task.set({
      title: body.title ?? task.title,
      notes: body.notes ?? task.notes,
      tags: body.tags ?? task.tags,
      priority: body.priority ?? task.priority,
      sortOrder: body.sortOrder ?? task.sortOrder,
      planDate: body.planDate ?? task.planDate,
      estimatePomodoros: body.estimatePomodoros ?? task.estimatePomodoros,
      donePomodoros: body.donePomodoros ?? task.donePomodoros,
      completed: body.completed ?? task.completed,
      completedAt: body.completedAt ? new Date(body.completedAt as number) : task.completedAt,
      deleted: body.deleted ?? task.deleted,
    })
  }
  if (body.createdAt) task.createdAt = new Date(body.createdAt as number)
  if (body.updatedAt) task.updatedAt = new Date(body.updatedAt as number)
  await task.save()
  res.json(ok(json(task)))
})

// PUT /tasks/:id
taskRouter.put('/:id', auth(), async (req: Request, res: Response) => {
  const uid = userId(req)
  const body = (req.body || {}) as Record<string, unknown>
  const task = await Task.findOne({ _id: req.params.id, userId: uid })
  if (!task) {
    res.status(404).json(err(404, '任务不存在'))
    return
  }
  const clientTs = Number(body.updatedAt) || 0
  if (clientTs && clientTs < task.updatedAt.getTime()) {
    res.json(ok(json(task))) // 旧数据不回写
    return
  }
  for (const key of [
    'title', 'notes', 'tags', 'priority', 'sortOrder', 'planDate',
    'estimatePomodoros', 'donePomodoros', 'completed', 'deleted',
  ]) {
    if (body[key] !== undefined) (task as unknown as { set: (k: string, v: unknown) => void }).set(key, body[key])
  }
  if (body.completedAt !== undefined) task.completedAt = body.completedAt ? new Date(body.completedAt as number) : undefined
  if (body.updatedAt) task.updatedAt = new Date(body.updatedAt as number)
  await task.save()
  res.json(ok(json(task)))
})

// DELETE /tasks/:id —— 软删除（同步友好）
taskRouter.delete('/:id', auth(), async (req: Request, res: Response) => {
  const uid = userId(req)
  const task = await Task.findOne({ _id: req.params.id, userId: uid })
  if (!task) {
    res.status(404).json(err(404, '任务不存在'))
    return
  }
  task.deleted = true
  task.updatedAt = new Date()
  await task.save()
  res.json(ok({ ok: true }))
})
