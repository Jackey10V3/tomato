/**
 * 专注防打扰。
 * 安卓：检测当前前台应用是否命中「娱乐 App」名单并提示（需 UsageStats 授权 + 原生插件）。
 * 鸿蒙：第三方无法读取他应用使用情况 → 能力降级为免打扰引导/沉浸 UI（设计方案 4.4）。
 */

export interface GuardResult {
  /** 是否命中需要拦截的娱乐 App */
  hit: boolean
  appName?: string
}

/** 需提示退出的娱乐 App 包名名单（可按需增删） */
export const DISTRACT_APPS = [
  'com.ss.android.ugc.aweme', // 抖音
  'com.tencent.mm', // 微信
  'com.tencent.mobileqq', // QQ
  'tv.danmaku.bili', // 哔哩哔哩
  'com.smile.gifmaker', // 快手
  'com.kuaishou.nebula', // 快手极速版
]

export const focusGuard = {
  /** 专注中检测当前前台应用。需「使用情况访问」授权；由原生插件实现 */
  async checkCurrentApp(): Promise<GuardResult> {
    // #ifdef APP-PLUS
    // TODO(M7)：接入原生插件读取 UsageStatsManager 前台包名后比对 DISTRACT_APPS
    // const pkg = await usagePlugin.getForegroundPackage()
    // if (pkg && DISTRACT_APPS.includes(pkg)) return { hit: true, appName: pkg }
    // #endif
    return { hit: false }
  },
  startGuard() {
    // #ifdef APP-PLUS
    // TODO(M7)：启动轮询
    // #endif
  },
  stopGuard() {
    // #ifdef APP-PLUS
    // TODO(M7)
    // #endif
  },
}
