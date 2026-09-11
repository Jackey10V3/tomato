/**
 * 常亮 + 后台保活。
 *
 * 说明：uni.setKeepScreenOn 只能防止「前台息屏」；
 * 真正的后台计时保活依赖原生前台服务（安卓）/ 长时任务（鸿蒙），
 * 需以 uts 插件接入后替换 TODO 分支（设计方案 4.4）。
 *
 * 单对象 + 行内 #ifdef：既满足条件编译需求，又不产生 TS 重复声明。
 */

export const keepAlive = {
  start() {
    // #ifdef APP-PLUS
    // ① 前台期间防息屏（安卓/iOS）
    uni.setKeepScreenOn({ keepScreenOn: true })
    // ② 后台保活：原生前台服务插件（uts 封装 foreground service）
    // TODO(M2)：接入「Tomato-TimerService」uts 插件后启用
    // const svc = uni.requireNativePlugin('Tomato-TimerService')
    // svc.startTimer({ durationMs })
    // #endif
    // #ifdef APP-HARMONY
    // TODO(M6)：uts 插件调用 backgroundTaskManager(AUDIO_PLAYBACK) + 持续通知
    // ;(globalThis as any).HarmonyKeepAlive?.startLongRunning?.()
    // #endif
    console.log('[platform/keepAlive] start', this)
  },
  stop() {
    // #ifdef APP-PLUS
    uni.setKeepScreenOn({ keepScreenOn: false })
    // TODO(M2)：svc.stopTimer()
    // #endif
    // #ifdef APP-HARMONY
    // ;(globalThis as any).HarmonyKeepAlive?.stopLongRunning?.()
    // #endif
    console.log('[platform/keepAlive] stop')
  },
}

