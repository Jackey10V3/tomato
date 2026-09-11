/** 生成客户端 UUID（离线记录 / 去重定位用） */
export function uuid(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  return `${t}-${r}`
}

/** 本地毫秒时间戳 */
export function now(): number {
  return Date.now()
}
