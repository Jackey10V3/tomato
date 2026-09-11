/**
 * 入场动画重播。
 *
 * 背景：uni-app 的 tab 页是缓存复用的（实测切走再切回，页面根节点 DOM 还在），
 * 所以 `.fade-row` 这类入场动画只在首次进入时播一次。
 *
 * 演进（两种做法都试过，这里要注意别退回去）：
 *
 * 1）早期：给根节点加 .anim-reset 把动画设为 none，下一帧再摘掉。
 *    → 页面已可见时会出现「内容完整显示 → 消失 → 再淡入」，就是用户说的"闪一下"。
 *
 * 2）上一版：改 key 重建内容子树。
 *    → 不闪了，但每次切页都要销毁并重建整棵子树（几十个节点），
 *      手机上这段是实打实的主线程开销，表现为"切页卡一下"。
 *
 * 3）现在：用 Web Animations API 把已有动画拨回起点重播（首选）。
 *    → 零 DOM 变更，既没有重建成本，也不会闪烁。
 *    注意要在 nextTick 里做：onShow 那一刻页面 DOM 可能还没挂回文档
 *    （实测此时查得到 0 个动画元素），nextTick 属于微任务、仍在绘制之前，不闪。
 *
 * 用法：
 *   const { animKey } = useEnterAnim()
 *   <scroll-view class="t-body"><view :key="animKey"> ...内容... </view></scroll-view>
 *
 * 注意：key 要放在滚动容器**内部**，这样回退到重建时也不会丢滚动位置。
 */
import { nextTick, onUnmounted, ref, type Ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

/** 刚挂载多久内不重播（这段时间入场动画本来就正在播，再触发一次会造成闪动） */
const FRESH_MOUNT_MS = 600

/** 入场动画元素的选择器与 useEnterAnim 保持一致的约定 */
const ANIM_SELECTOR = '.fade-row, .slide-in-left'

/**
 * 把页面里已有的入场动画拨回起点重播。
 * 返回是否成功（失败时调用方需要回退到重建节点的老办法）。
 */
function restartAnimations(): boolean {
  try {
    const doc = (globalThis as { document?: Document }).document
    if (!doc || typeof doc.querySelectorAll !== 'function') return false

    const els = doc.querySelectorAll(ANIM_SELECTOR)
    if (!els.length) return false

    let hit = false
    for (let i = 0; i < els.length; i++) {
      const el = els[i] as Element & { getAnimations?: () => Animation[] }
      if (typeof el.getAnimations !== 'function') continue
      const anims = el.getAnimations()
      if (!anims || !anims.length) continue
      for (let j = 0; j < anims.length; j++) {
        const a = anims[j]
        try {
          a.currentTime = 0
          if (typeof a.play === 'function') a.play()
          hit = true
        } catch {
          /* 单个动画失败不影响其他 */
        }
      }
    }
    return hit
  } catch {
    return false
  }
}

export function useEnterAnim(): { animKey: Ref<number> } {
  const animKey = ref(0)
  const mountedAt = Date.now()
  let disposed = false

  function replay() {
    if (disposed) return
    if (Date.now() - mountedAt < FRESH_MOUNT_MS) return

    /*
     * 关键：onShow 触发的那一刻，页面 DOM 可能还没被挂回文档
     *（实测此时 querySelectorAll 查到 0 个动画元素），所以必须让出一个微任务。
     * 微任务仍在浏览器绘制之前执行，因此不会出现"先看到完整内容再重来"的闪烁。
     */
    nextTick(() => {
      if (disposed) return
      const ok = restartAnimations()
      if (ok) return
      // 兜底：拿不到动画对象（部分平台没有 Web Animations API）时，才退回重建节点
      animKey.value += 1
    })
  }

  // 同步触发（不放到 nextTick）：让动画起点和页面显示落在同一帧
  onShow(replay)

  onUnmounted(() => {
    disposed = true
  })

  return { animKey }
}
