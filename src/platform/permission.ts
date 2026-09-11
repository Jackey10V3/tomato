/**
 * 权限申请与引导。
 * 安卓：通知(Android 13+)可运行时申请；悬浮窗/使用情况访问/忽略电池优化属特殊授权，
 *       只能引导用户跳系统设置（permission-guide.vue 展示检测与回跳）。
 * 鸿蒙：通知授权运行时引导；长时任务等权限声明于 harmony-configs/module.json5。
 */

export const permission = {
  /** 通知权限（Android 13+ / 鸿蒙运行时引导） */
  ensureNotifyPermission(): Promise<boolean> {
    return new Promise(resolve => {
      // #ifdef APP-PLUS
      try {
        const plusAny = plus as unknown as {
          android: { requestPermissions: (p: string[], ok: () => void, no: () => void) => void }
        }
        plusAny.android.requestPermissions(
          ['android.permission.POST_NOTIFICATIONS'],
          () => resolve(true),
          () => resolve(false),
        )
      } catch {
        resolve(true)
      }
      // #endif
      // #ifndef APP-PLUS
      resolve(true)
      // #endif
    })
  },

  /** 悬浮窗 / 使用情况访问 / 电池优化等：跳系统设置页由用户开启 */
  openSystemSettings() {
    // #ifdef APP-PLUS
    uni.openAppAuthorizeSetting({})
    // #endif
  },

  /** 引导用户去对应系统设置子页（文案由页面给出） */
  goPermissionPage(_perm: 'overlay' | 'usage' | 'battery' | 'notify') {
    // TODO(M2/M7)：封装各特殊权限的检测与「跳对应设置子页」Intent（原生插件）
    // #ifdef APP-PLUS
    uni.openAppAuthorizeSetting({})
    // #endif
  },
}
