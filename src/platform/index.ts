/**
 * 平台能力统一出口。
 * 页面 / store / composables 只允许从这里拿平台能力，禁止直接书写平台分支。
 * #ifdef 条件编译只允许出现在 platform/* 内部。
 *
 * 原生能力接入进度（详见设计方案 4.4）：
 *  - 安卓前台服务保活 / 鸿蒙长时任务：需 uts 插件，TODO(M6)
 *  - 本地通知 / 白噪音后台播放：需原生插件，TODO(M2/M4)
 */

import { keepAlive } from './keepAlive'
import { notify } from './notify'
import { permission } from './permission'
import { focusGuard } from './focusGuard'
import { audio } from './audio'
import { haptic } from './haptic'
import type { Snapshot } from '@/types/pomodoro'

export const platform = {
  keepAlive,
  notify,
  permission,
  focusGuard,
  audio,
  haptic,

  /** 通知栏展示 / 更新当前阶段进度 */
  refreshNotification(s: Snapshot) {
    if (s.status !== 'running') return
    const remainMin = Math.max(1, Math.ceil((s.endAt - Date.now()) / 60000))
    notify.show(
      s.phase === 'focus' ? '专注中' : '休息中',
      `还剩 ${remainMin} 分钟${s.phase === 'focus' ? '，保持专注 🍅' : '，放松一下'}`,
    )
  },

  /** 状态迁移时同步原生保活服务 / 通知 */
  onPhaseChange(s: Snapshot) {
    if (s.status === 'running') {
      this.keepAlive.start()
      this.refreshNotification(s)
    } else {
      this.keepAlive.stop()
      notify.clear()
    }
  },
}
