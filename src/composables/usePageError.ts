/**
 * 页面级错误兜底。
 *
 * 背景：渲染期抛错会让整页白屏，用户看不到任何信息（此前只有统计页做了兜底，
 * 其余页面崩溃依旧白屏）。这里统一：捕获 → 落日志（可在「我的-诊断信息」查看）
 * → 交给 <PageError> 显示错误卡，页面其余部分继续可用。
 *
 * 用法：
 *   const { pageError, copyErr, dismiss } = usePageError('task-page')
 *   <PageError v-if="pageError" :message="pageError" @copy="copyErr" @dismiss="dismiss" />
 */
import { onErrorCaptured, ref } from 'vue'
import { logError } from '@/utils/debugLog'

export function usePageError(where: string) {
  const pageError = ref('')

  onErrorCaptured(e => {
    pageError.value = String((e as { message?: string })?.message || e)
    logError(where, e)
    // 返回 false 阻止错误继续向上冒泡（避免触发全局兜底后界面被替换）
    return false
  })

  function copyErr() {
    uni.setClipboardData({
      data: `【页面报错】${where}\n${pageError.value}`,
      success: () => uni.showToast({ title: '已复制，可发给开发者', icon: 'none' }),
    })
  }

  function dismiss() {
    pageError.value = ''
  }

  return { pageError, copyErr, dismiss }
}
