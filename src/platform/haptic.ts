/**
 * 触感反馈统一出口。
 * 页面 / store / composables 只允许从这里拿触感能力，禁止直接书写平台分支。
 *
 * 各端支持情况：
 *  - App（安卓 / iOS / 鸿蒙）：uni.vibrateShort / uni.vibrateLong
 *    ⚠️ 鸿蒙需要在鸿蒙工程里声明 ohos.permission.VIBRATE，否则系统直接忽略（不报错，表现为"没反应"）
 *  - H5：navigator.vibrate。安卓浏览器支持；iOS Safari 不支持（静默降级，不报错）
 *  - 小程序：uni.vibrateShort 可用
 */

/** H5 的 navigator.vibrate 包装（不支持的端会返回 false，不抛错） */
function navVibrate(pattern: number | number[]): boolean {
  try {
    const nav = (globalThis as { navigator?: { vibrate?: (p: number | number[]) => boolean } }).navigator
    if (nav && typeof nav.vibrate === 'function') return nav.vibrate(pattern)
  } catch {
    /* 不支持则忽略 */
  }
  return false
}

export const haptic = {
  /** 轻反馈：开始 / 暂停 / 点击确认 */
  light() {
    // #ifdef APP-PLUS || APP-HARMONY
    try {
      uni.vibrateShort({})
    } catch {
      /* 不支持则忽略 */
    }
    // #endif
    // #ifdef H5
    navVibrate(15)
    // #endif
  },

  /** 强反馈：完成 / 警告 / 判罚（长时间或节奏型振动） */
  heavy() {
    // #ifdef APP-PLUS || APP-HARMONY
    try {
      uni.vibrateLong({})
    } catch {
      /* 不支持则忽略 */
    }
    // #endif
    // #ifdef H5
    navVibrate([0, 45, 70, 45])
    // #endif
  },

  /**
   * 是否具备触感能力（用于设置页给出提示，避免用户以为是 bug）。
   * H5 下 iOS Safari 没有 navigator.vibrate，返回 false。
   */
  isSupported(): boolean {
    // #ifdef H5
    const nav = (globalThis as { navigator?: { vibrate?: unknown } }).navigator
    return !!(nav && typeof nav.vibrate === 'function')
    // #endif
    // #ifndef H5
    return true
    // #endif
  },
}
