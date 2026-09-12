import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User, type UserDoc } from '../models/user'
import { err, ok, JWT_SECRET } from '../config/env'
import { json } from '../config/db'
import { auth } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'

export const authRouter = Router()

// 公网暴露的注册/登录加限流：同一 IP 5 分钟内最多 20 次，防暴力刷接口
const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20 })
authRouter.use(authLimiter)

function sign(user: UserDoc) {
  return jwt.sign({ uid: String(user._id), nickname: user.nickname }, JWT_SECRET, {
    expiresIn: '30d',
  })
}
function toSafe(user: UserDoc) {
  const u = json(user)
  delete u.passwordHash
  return u
}

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { account, password, nickname } = (req.body || {}) as {
    account?: string
    password?: string
    nickname?: string
  }
  if (!account || !password) {
    res.status(400).json(err(400, '账号与密码必填'))
    return
  }
  if (String(password).length < 6) {
    res.status(400).json(err(400, '密码至少 6 位'))
    return
  }
  const exists = await User.findOne({ account: String(account).toLowerCase() })
  if (exists) {
    res.status(409).json(err(409, '账号已存在'))
    return
  }
  const passwordHash = await bcrypt.hash(String(password), 10)
  const user = await User.create({
    account: String(account).toLowerCase(),
    passwordHash,
    nickname: nickname || `番茄${account.slice(0, 4)}`,
  })
  res.json(ok({ ...toSafe(user), token: sign(user) }))
})

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { account, password } = (req.body || {}) as { account?: string; password?: string }
  if (!account || !password) {
    res.status(400).json(err(400, '账号与密码必填'))
    return
  }
  const user = await User.findOne({ account: String(account).toLowerCase() })
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    res.status(401).json(err(401, '账号或密码错误'))
    return
  }
  res.json(ok({ ...toSafe(user), token: sign(user) }))
})

// PUT /auth/me —— 更新个人资料（昵称/头像），资料同步用
authRouter.put('/me', auth(), async (req: Request, res: Response) => {
  const user = await User.findById(req.auth!.uid)
  if (!user) {
    res.status(404).json(err(404, '用户不存在'))
    return
  }
  const { nickname, avatar } = (req.body || {}) as { nickname?: string; avatar?: string }
  if (typeof nickname === 'string' && nickname.trim()) user.nickname = nickname.trim()
  if (typeof avatar === 'string' && avatar) user.avatar = avatar
  user.updatedAt = new Date()
  await user.save()
  res.json(ok(toSafe(user)))
})

// GET /auth/me
authRouter.get('/me', auth(), async (req: Request, res: Response) => {
  const user = await User.findById(req.auth!.uid)
  if (!user) {
    res.status(404).json(err(404, '用户不存在'))
    return
  }
  res.json(ok(toSafe(user)))
})
