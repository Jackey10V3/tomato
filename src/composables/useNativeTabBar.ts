/**
 * 压制原生 tabBar —— 自定义悬浮 Dock（TabDock）的配套措施。
 *
 * 真机踩坑结论：uni.hideTabBar 只在「页面生命周期」(onShow/onLoad) 里调用才可靠；
 * 放在普通组件的 onMounted 里，App/鸿蒙端经常静默无效 —— 原生栏会原样压在
 * 自定义 Dock 下面，露出一条白色底栏。另外 switchTab 切到新页后原生栏会重新出现，
 * 所以每个 tab 页 onShow 都要再压一次，并带 fail 重试兜底（tabbar 未就绪时会 fail）。
 */
import { onShow } from '@dcloudio/uni-app'

/** 隐藏原生 tabBar；失败自动重试若干次（间隔 120ms） */
export function hideNativeTabBar(retries = 4) {
  try {
    uni.hideTabBar({
      animation: false,
      fail: () => {
        if (retries > 0) setTimeout(() => hideNativeTabBar(retries - 1), 120)
      },
    })
  } catch {
    /* 平台不支持时静默：Dock 会与原生栏重叠，但不影响功能 */
  }
}

/** 在 tab 页 setup 里调用一次：注册 onShow 压制 + setup 时立即压一次 */
export function useNativeTabBar() {
  onShow(() => hideNativeTabBar())
  hideNativeTabBar()
}
