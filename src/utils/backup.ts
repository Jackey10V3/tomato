/** 备份 / 恢复：导出全部本地数据为 JSON，或从 JSON 恢复（防更新/换机丢数据） */

export interface BackupPayload {
  app: 'tomato-todo'
  version: number
  exportedAt: number
  tasks: unknown
  lists: unknown
  records: unknown
  settings: unknown
}

export function buildBackup(read: {
  tasks: unknown
  lists: unknown
  records: unknown
  settings: unknown
}): string {
  const payload: BackupPayload = {
    app: 'tomato-todo',
    version: 1,
    exportedAt: Date.now(),
    ...read,
  }
  return JSON.stringify(payload)
}

export function parseBackup(text: string): BackupPayload | null {
  try {
    const obj = JSON.parse(text) as BackupPayload
    if (obj?.app !== 'tomato-todo') return null
    return obj
  } catch {
    return null
  }
}
