/**
 * 轻量错误日志：把运行时错误写到本地，供诊断页展示。
 * 目的：手机端出现白屏时能直接看到真实报错，而不是只能猜。
 */
import { storage } from './storage'

const K = 'debug:errors'

export interface DebugError {
  time: number
  where: string
  message: string
  stack?: string
}

export function logError(where: string, e: unknown): void {
  try {
    const err = e as { message?: string; stack?: string }
    const list = listErrors()
    list.unshift({
      time: Date.now(),
      where,
      message: String(err?.message || e || 'unknown'),
      stack: err?.stack ? String(err.stack).slice(0, 800) : undefined,
    })
    storage.set(K, JSON.stringify(list.slice(0, 20)))
  } catch {
    /* 记录失败就算了，别影响主流程 */
  }
}

export function listErrors(): DebugError[] {
  const raw = storage.get<string>(K)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as DebugError[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function clearErrors(): void {
  storage.remove(K)
}

export function errorText(): string {
  return listErrors()
    .map(e => `[${new Date(e.time).toLocaleString?.() || e.time}] (${e.where}) ${e.message}${e.stack ? `\n${e.stack}` : ''}`)
    .join('\n\n')
}
