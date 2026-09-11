/**
 * 本版为「本地优先」实现，云同步暂缓（设计方案后续版本接入）。
 * 占位保留统一入口，避免页面出现同步相关硬编码。
 */

export function useSync() {
  const enabled = false

  async function syncAll(): Promise<boolean> {
    if (!enabled) return false
    return false
  }
  return { syncAll, enabled }
}
