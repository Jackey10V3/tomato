import { Router, type Request, type Response } from 'express'
import { heatmap, report } from '../services/stats'
import { err, ok } from '../config/env'
import { auth } from '../middleware/auth'

export const statsRouter = Router()

// GET /stats/heatmap?from=&to=
statsRouter.get('/heatmap', auth(), async (req: Request, res: Response) => {
  const uid = req.auth!.uid
  const from = Number(req.query.from)
  const to = Number(req.query.to)
  if (!from || !to || from >= to) {
    res.status(400).json(err(400, 'from/to 时间戳参数非法'))
    return
  }
  const data = await heatmap(uid, from, to)
  res.json(ok(data))
})

// GET /stats/report?range=week|month
statsRouter.get('/report', auth(), async (req: Request, res: Response) => {
  const uid = req.auth!.uid
  const range = req.query.range === 'month' ? 'month' : 'week'
  res.json(ok(await report(uid, range)))
})
