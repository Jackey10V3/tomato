import mongoose from 'mongoose'
import { MONGODB_URI } from './env'

/**
 * 连库（带重试与友好提示）。
 * 公网部署（Render 等）时最常见的失败原因：
 *   1. Atlas「Network Access」没放行 0.0.0.0/0 —— 默认拦截所有外部 IP；
 *   2. MONGODB_URI 里密码/库名写错（串里应有 /tomato?retryWrites=true&w=majority）。
 * 连不上时打human可读提示，并重试 3 次（Atlas 冷启动偶发抖动）。
 */
function hidePass(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
}

async function tryConnect(): Promise<void> {
  mongoose.set('strictQuery', false)
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
}

export async function connectDb(): Promise<void> {
  const maxTries = 3
  for (let i = 1; i <= maxTries; i++) {
    try {
      await tryConnect()
      console.log('[db] connected:', hidePass(MONGODB_URI))
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[db] 第 ${i}/${maxTries} 次连接失败：${msg}`)
      console.error('[db] 排查提示：① Atlas → Network Access 是否已放行 0.0.0.0/0；')
      console.error('[db]           ② MONGODB_URI 是否完整（含密码、/tomato、?retryWrites=true&w=majority）')
      if (i < maxTries) await new Promise(r => setTimeout(r, 5000))
      else throw e
    }
  }
}

export function json<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T
}
