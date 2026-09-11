import { Router, type Request, type Response } from 'express'
import { Room } from '../models/room'
import { err, ok } from '../config/env'
import { json } from '../config/db'
import { auth } from '../middleware/auth'
import { roomHub } from '../ws/roomHub'

export const roomRouter = Router()

// GET /rooms —— 房间列表 + 实时在线人数（由 RoomHub 汇总）
roomRouter.get('/', auth(true), async (_req: Request, res: Response) => {
  const rooms = await Room.find({ status: 'open' }).sort({ createdAt: -1 }).limit(100)
  const data = rooms.map(r => ({
    ...json(r),
    onlineCount: roomHub.onlineCount(String(r._id)),
  }))
  res.json(ok(data))
})

// POST /rooms
roomRouter.post('/', auth(), async (req: Request, res: Response) => {
  const uid = req.auth!.uid
  const name = String((req.body || {}).name || '').trim()
  if (!name) {
    res.status(400).json(err(400, '房间名必填'))
    return
  }
  const room = await Room.create({
    name,
    ownerId: uid,
    maxMembers: Math.min(200, Math.max(2, Number((req.body || {}).maxMembers) || 50)),
  })
  res.json(ok({ ...json(room), onlineCount: 0 }))
})
