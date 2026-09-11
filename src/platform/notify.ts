/**
 * 本地通知（计时进度 / 完成提醒）。
 * App 端优先使用原生本地通知插件；未接入前降级为控制台日志，避免阻塞开发。
 */

export const notify = {
  show(title: string, content: string) {
    // #ifdef APP-PLUS
    // TODO(M2)：接入本地通知 uts 插件（Android NotificationChannel + 前台服务通知）
    // notifyPlugin.show(title, content)
    // #endif
    // #ifdef APP-HARMONY
    // TODO(M6)：接入鸿蒙持续通知
    // #endif
    // 调试日志已移除
  },
  clear() {
    // 调试日志已移除
  },
}
