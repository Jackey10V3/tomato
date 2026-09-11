import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'

export interface AuthInfo {
  uid: string
  nickname: string
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo
  }
}

function parseToken(header?: string): AuthInfo | null {
  if (!header) return null
  try {
    const token = header.replace(/^Bearer\s+/i, '')
    const payload = jwt.verify(token, JWT_SECRET) as { uid: string; nickname?: string }
    return { uid: payload.uid, nickname: payload.nickname || '番茄同学' }
  } catch {
    return null
  }
}

/** 鉴权中间件；optional=true 时允许匿名 */
export function auth(optional = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const info = parseToken(req.headers.authorization)
    if (!info && !optional) {
      res.status(401).json({ code: 401, message: '未登录或登录已过期', data: null })
      return
    }
    if (info) req.auth = info
    next()
  }
}
