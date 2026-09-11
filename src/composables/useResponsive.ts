/**
 * 屏幕尺寸 / 方向响应式 —— 平板与横屏适配的统一入口。
 *
 * 为什么用 JS 判定而不是 CSS @media：
 *   鸿蒙渲染层（uni-app-harmony-framework）里没有 matchMedia，媒体查询不可靠；
 *   而 uni.getSystemInfoSync / uni.onWindowResize 在 H5、App、鸿蒙上都可用。
 *
 * 断点（与 pages.json → globalStyle.rpxCalcMaxDeviceWidth 保持一致）：
 *   winW <  600  手机：不加任何 class，原样
 *   winW >= 600  宽屏：.is-wide —— 运行时把 rpx 基准锁到 480（见下方说明），
 *                        布局再把内容居中限宽，避免平板上被横向拉长
 *   winW >= 1000 更宽：.is-2col —— 卡片走两栏
 *   宽度 > 高度      ：.is-landscape —— 收紧纵向留白、避开刘海安全区
 *
 * ⚠️ rpx 基准为什么必须锁：
 *   uni-app 的 rpx 会随窗口宽度等比放大（rem 基准 = 窗口宽 / 23.4375）。
 *   不锁的话，1280px 宽的平板横屏下 40rpx 的标题会变成 68px。
 *   运行时规则是「窗口宽 > rpxCalcMaxDeviceWidth 时改用 rpxCalcBaseDeviceWidth」，
 *   所以这里把 max 设为 600、base 设为 480：任何比 600 宽的屏幕都按 480 基准渲染，
 *   手机上（≤600）则仍然按自身宽度，不受影响。
 */
import { computed, ref } from 'vue'

/** 宽屏阈值（px/vp） */
const WIDE_MIN = 600
/** 两栏阈值：够宽才分栏，否则两栏会太窄 */
const TWO_COL_MIN = 1000

const winW = ref(375)
const winH = ref(667)
let inited = false

/** 读取一次系统尺寸（失败时保留上一次的值，不抛错） */
function read() {
  try {
    const info = uni.getSystemInfoSync()
    const w = Number(info.windowWidth) || Number(info.screenWidth) || 0
    const h = Number(info.windowHeight) || Number(info.screenHeight) || 0
    if (w > 0) winW.value = w
    if (h > 0) winH.value = h
  } catch {
    /* 忽略：保持原值 */
  }
}

/** 模块级只注册一次监听，避免每个页面各挂一个 */
function ensure() {
  if (inited) return
  inited = true
  read()
  try {
    // 旋转屏幕 / 平板分屏 / 桌面端改窗口大小
    uni.onWindowResize?.(() => read())
  } catch {
    /* 忽略：不支持时只依赖首次读取 */
  }
  // 启动瞬间部分平台还没拿到真实尺寸，稍后再校准一次
  setTimeout(read, 300)
}

export function useResponsive() {
  ensure()

  const isWide = computed(() => winW.value >= WIDE_MIN)
  const isLandscape = computed(() => winW.value > winH.value)
  const isTwoCol = computed(() => winW.value >= TWO_COL_MIN)

  /** 直接绑在页面根节点上：:class="layoutClass" */
  const layoutClass = computed(() => ({
    'is-wide': isWide.value,
    'is-landscape': isLandscape.value,
    'is-2col': isTwoCol.value,
  }))

  return { winW, winH, isWide, isLandscape, isTwoCol, layoutClass, refresh: read }
}
