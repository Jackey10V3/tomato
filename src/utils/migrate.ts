/**
 * 数据版本与迁移：保证应用更新时**不覆盖/不丢失**用户数据。
 * 所有数据都在 uni storage 的 tomato:* 命名空间下；升级只做「补齐默认值」与「结构迁移」，
 * 绝不删除用户已有的任务、专注记录与设置。
 */
import { storage } from './storage'

const K_VERSION = 'schema:version'
/** 当前数据结构版本：新增字段时 +1 并在此登记迁移 */
export const SCHEMA_VERSION = 1

export interface MigrateResult {
  from: number
  to: number
  migrated: string[]
}

export function ensureSchema(): MigrateResult {
  const raw = storage.get<string>(K_VERSION)
  const from = raw ? Number(raw) || 0 : 0
  const migrated: string[] = []

  if (from < 1) {
    // v0 → v1：早期版本设置里没有 examName / dark / poster / volume 等字段，
    // 由 settings store 深合并补齐默认值；任务/记录不做任何改动。
    const settingsRaw = storage.get<string>('settings:app')
    if (settingsRaw) {
      try {
        const parsed = JSON.parse(settingsRaw) as Record<string, unknown>
        const patched: Record<string, unknown> = {
          examName: parsed.examName ?? '考研',
          examDate: parsed.examDate ?? '2026-12-26',
          examTime: parsed.examTime ?? '08:30',
          dark: parsed.dark ?? false,
          poster: parsed.poster ?? 'classic',
          volume: parsed.volume ?? 0.85,
          ...parsed,
        }
        storage.set('settings:app', JSON.stringify(patched))
        migrated.push('settings')
      } catch {
        /* 保留原数据，不做破坏性处理 */
      }
    }
  }

  storage.set(K_VERSION, String(SCHEMA_VERSION))
  return { from, to: SCHEMA_VERSION, migrated }
}

export function dataVersion(): number {
  return Number(storage.get<string>(K_VERSION)) || 0
}
