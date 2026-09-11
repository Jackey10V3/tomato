/**
 * 把 html 画布（documentElement）底色刷成页面同款背景。
 *
 * 为什么需要：鸿蒙端 Web 容器通过 expandSafeArea 延伸到状态栏/小白条手势区下面，
 * 而页面 HTML 只有 100vh 高、盖不到那一段，露出的画布默认是白底 ——
 * 表现为"页面底部有一条大白边，做不到沉浸"。
 * 页面卸载时恢复为空（回落到全局 page 背景），避免把别的页面也染色。
 */
import { onMounted, onUnmounted } from 'vue'

export function useCanvasBg(bg: () => string) {
  const apply = () => {
    try {
      const doc = (globalThis as { document?: Document }).document
      if (doc?.documentElement) doc.documentElement.style.background = bg()
    } catch {
      /* 非 Web 环境（App 原生渲染端）没有 document，忽略 */
    }
  }
  const reset = () => {
    try {
      const doc = (globalThis as { document?: Document }).document
      if (doc?.documentElement) doc.documentElement.style.background = ''
    } catch {
      /* ignore */
    }
  }
  onMounted(apply)
  onUnmounted(reset)
  return { apply, reset }
}
