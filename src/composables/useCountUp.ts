/**
 * 数字生长动效：目标值变化时按缓出曲线滚动到位。
 *
 * 用于统计页的各种数字，避免数字"啪"地跳变。
 * 兼容性考虑：不用 requestAnimationFrame（小程序端部分环境缺失），
 * 统一走 setTimeout(16) 定时步进。
 */
import { onUnmounted, ref, watch, type Ref } from 'vue'

export function useCountUp(target: Ref<number> | (() => number), duration = 700): Ref<number> {
  const raw = typeof target === 'function' ? target : () => target.value
  // 取值失败/非法时给 0，避免异常值把整页渲染打断（真机上曾出现白屏）
  const get = () => {
    try {
      const v = Number(raw())
      return Number.isFinite(v) ? v : 0
    } catch {
      return 0
    }
  }
  const display = ref(0)

  let timer: ReturnType<typeof setTimeout> | null = null
  let startTs = 0
  let from = 0
  let to = get()

  function stop() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function step() {
    const t = Math.min(1, (Date.now() - startTs) / duration)
    const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
    display.value = from + (to - from) * eased
    if (t < 1) timer = setTimeout(step, 16)
    else {
      display.value = to
      timer = null
    }
  }

  function animate() {
    stop()
    to = get()
    if (to === from && to === display.value) return
    from = display.value
    if (to === from) {
      display.value = to
      return
    }
    startTs = Date.now()
    step()
  }

  watch(get, animate, { immediate: true })
  onUnmounted(stop)

  return display
}
