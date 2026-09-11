/**
 * 入场动画重播（重建节点版）。
 *
 * 背景：uni-app 的页面是缓存复用的，onMounted 只在首次进入时触发，
 * 所以 `.fade-row` 这类入场动画"只播一次"——切 tab 回来、从子页返回都看不到动画。
 *
 * 为什么不用"关掉动画再打开"的写法：页面已经可见时，
 * 关掉动画会让内容先完整显示一帧、再重新淡入，形成「显示 → 消失 → 淡入」的两段跳变，
 * 看上去就是"闪一下"。这里改成改变 key 触发节点重建：
 * 新旧节点在同一帧交替，动画从头开始且全程不被打断，观感是干净的入场。
 *
 * 用法：
 *   const { animKey } = useEnterAnim()
 *   <scroll-view class="t-body"><view :key="animKey"> ...内容... </view></scroll-view>
 *
 * 注意：key 要放在滚动容器**内部**，这样重建内容不会丢掉滚动位置。
 */
import { onUnmounted, ref, type Ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

/** 刚挂载多久内不重播（这段时间入场动画本来就正在播，再触发一次会造成闪动） */
const FRESH_MOUNT_MS = 600

export function useEnterAnim(): { animKey: Ref<number> } {
  const animKey = ref(0)
  const mountedAt = Date.now()
  let disposed = false

  function replay() {
    if (disposed) return
    if (Date.now() - mountedAt < FRESH_MOUNT_MS) return
    animKey.value += 1
  }

  // 同步触发（不放到 nextTick）：让节点替换和页面显示落在同一帧，避免多显示一帧旧内容
  onShow(replay)

  onUnmounted(() => {
    disposed = true
  })

  return { animKey }
}
