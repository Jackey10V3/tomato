/** 页面公共：自绘导航所需的状态栏高度 / 返回 / 简单弹层开关 */
import { ref } from 'vue'

export function useChrome() {
  let statusBarH = 20
  try {
    const info = uni.getSystemInfoSync()
    statusBarH = info.statusBarHeight || 20
  } catch {
    /* 默认值兜底 */
  }

  function goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      uni.navigateBack()
    } else {
      uni.switchTab({ url: '/pages/task/index' })
    }
  }

  return { statusBarH, goBack }
}

export function useSheet(init = false) {
  const visible = ref(init)
  return { visible }
}
