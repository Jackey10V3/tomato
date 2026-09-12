import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { err, ok } from './config/env'
import { authRouter } from './routes/auth'
import { taskRouter } from './routes/task'
import { focusRouter } from './routes/focus'
import { statsRouter } from './routes/stats'
import { roomRouter } from './routes/room'

export function createApp(): express.Express {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  app.get('/', (_req, res) => {
    res.json(ok({ name: '番茄Todo server', health: '/health', api: '/api/v1' }))
  })

  app.get('/health', (_req, res) => {
    res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } })
  })

  const api = express.Router()
  api.use('/auth', authRouter)
  api.use('/tasks', taskRouter)
  api.use('/focus-records', focusRouter)
  api.use('/stats', statsRouter)
  api.use('/rooms', roomRouter)
  app.use('/api/v1', api)

  // 404
  app.use((_req, res) => {
    res.status(404).json(err(404, '接口不存在'))
  })

  // 统一错误处理（含 mongoose CastError / 校验错误）
  app.use((e: Error, _req: Request, res: Response, _next: NextFunction) => {
    const name = e?.constructor?.name || ''
    if (name === 'CastError') {
      res.status(400).json(err(400, '参数格式错误'))
      return
    }
    console.error('[error]', e)
    res.status(500).json(err(500, e.message || '服务器内部错误'))
  })

  return app
}
