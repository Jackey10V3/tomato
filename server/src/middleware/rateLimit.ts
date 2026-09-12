/**
 * 极简内存版限流：保护公网暴露的注册/登录接口不被暴力刷。
 * 免费层单实例够用；若将来多实例部署，需换成 Redis 等共享存储。
 */
import type { NextFunction, Request, Response } from 'express'
import { err } from '../config/env'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(opts: { windowMs: number; max: number }) {
  // 定期清理过期桶，防 Map 无限增长
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
  }, 60_000).unref?.()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    let b = buckets.get(ip)
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(ip, b)
    }
    b.count++
    if (b.count > opts.max) {
      res.status(429).json(err(429, '请求太频繁，请稍后再试'))
      return
    }
    next()
  }
}
