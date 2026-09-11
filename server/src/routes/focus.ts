import { Router, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { FocusRecord } from '../models/focusRecord'
import { ok } from '../config/env'
import { json } from '../config/db'
import { auth } from '../middleware/auth'
import type { AuthInfo } from '../middleware/auth'

export const focusRouter = Router()

// POST /focus-records —— 记录一次专注/休息（只增不改）
focusRouter.post('/', auth(), async (req: Request, res: Response) => {
  const uid = (req.auth as AuthInfo).uid
  const body = (req.body || {}) as {
    kind?: 'focus' | 'break'
    taskId?: string | null
    phaseRound?: number
    plannedSec?: number
    actualSec?: number
    completed?: boolean
    abandonedReason?: string
    startedAt?: number
  }
  const now = new Date()
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date(now.getTime() - (body.actualSec || 0) * 1000)
  const doc = await FocusRecord.create({
    userId: uid,
    taskId: body.taskId ? new mongoose.Types.ObjectId(body.taskId) : undefined,
    kind: body.kind || 'focus',
    phaseRound: body.phaseRound ?? 0,
    plannedSec: body.plannedSec ?? 0,
    actualSec: body.actualSec ?? 0,
    completed: body.completed ?? true,
    abandonedReason: body.abandonedReason,
    startedAt,
    endedAt: now,
  })
  res.json(ok(json(doc)))
})

// GET /focus-records?page=&pageSize=
focusRouter.get('/', auth(), async (req: Request, res: Response) => {
  const uid = (req.auth as AuthInfo).uid
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50))
  const filter = { userId: uid }
  const [total, list] = await Promise.all([
    FocusRecord.countDocuments(filter),
    FocusRecord.find(filter).sort({ startedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
  ])
  res.json(ok({ list: list.map(json), total, page, pageSize }))
})
