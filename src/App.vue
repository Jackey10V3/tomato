<script setup lang="ts">
import { onLaunch, onHide, onError, onUnhandledRejection } from '@dcloudio/uni-app'
import { ensureSchema } from '@/utils/migrate'
import { unlockAudio } from '@/utils/audioEngine'
import { logError } from '@/utils/debugLog'
import { useFocusStore } from '@/store/modules/focus'

// 全局错误记录（手机端白屏时可在「我的-诊断信息」查看）
onError(e => {
  logError('app', e)
  console.error('[番茄Todo] error', e)
})
onUnhandledRejection(e => {
  logError('promise', e?.reason ?? e)
  console.error('[番茄Todo] unhandledRejection', e)
})

onLaunch(() => {
  // 数据版本迁移（只补齐/迁移，绝不覆盖用户数据）
  const r = ensureSchema()
  console.log('[番茄Todo] launched, schema', r.from, '→', r.to, r.migrated.length ? `migrated: ${r.migrated.join(',')}` : '')
  unlockAudio()
})

// 进后台/退出前把合并写入队列落盘，避免 250ms 窗口内的变更丢失
onHide(() => {
  try {
    useFocusStore().flush()
  } catch (e) {
    logError('app.onHide', e)
  }
})
</script>

<style lang="scss">

page {
  background-color: #faf6f3;
}

/* ===== 通用布局 token =====
   每个页面根节点 :style="themeStyle(theme)" 注入以下变量：
   --p-primary / --p-deep / --p-light / --p-bg / --p-card / --p-text / --p-sub / --p-radius */
.screen {
  min-height: 100vh;
  background: var(--p-bg, #faf6f3);
  color: var(--p-text, #2b2220);
  box-sizing: border-box;
}

/* 页头（自绘导航） */
.t-header {
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  height: 96rpx;
  position: relative;
  .t-title {
    font-size: 36rpx;
    font-weight: 700;
  }
  .t-back {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    font-size: 40rpx;
    margin-right: 8rpx;
  }
  .t-right {
    position: absolute;
    right: 28rpx;
    display: flex;
    align-items: center;
    gap: 8rpx;
  }
}

/* 卡片 */
.card {
  background: var(--p-card, #fff);
  border-radius: var(--p-radius, 24rpx);
  padding: 28rpx;
  margin: 20rpx 24rpx;
  box-shadow: var(--p-shadow, 0 6rpx 24rpx rgba(40, 20, 10, 0.05));
}

/* 主要按钮 */
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 28rpx;
  padding: 0 40rpx;
  height: 88rpx;
  color: #fff;
  background: var(--p-grad, var(--p-primary, #e53935));
  box-shadow: var(--p-shadow, 0 10rpx 24rpx rgba(229, 57, 53, 0.25));
  &.plain {
    background: var(--p-card, #fff);
    color: var(--p-text, #333);
    box-shadow: none;
    border: 2rpx solid var(--p-border, #eee);
  }
  &.disabled {
    opacity: 0.45;
    pointer-events: none;
  }
  &:active {
    transform: scale(0.97);
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999rpx;
  padding: 4rpx 18rpx;
  font-size: 22rpx;
  background: var(--p-soft, #f3efeb);
  color: var(--p-primary, #9e958f);
}

.subtext {
  color: var(--p-sub, #9e958f);
  font-size: 24rpx;
}

/* ===== 弹出卡片动画 ===== */
.pop-mask {
  position: fixed;
  top: 0; right: 0; bottom: 0; left: 0;
  background: rgba(15, 10, 8, 0.5);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40rpx;
  animation: fadeIn 0.18s ease;
}
.pop-card {
  width: 100%;
  max-width: 620rpx;
  background: var(--p-card, #fff);
  color: var(--p-text, #333);
  border-radius: 30rpx;
  padding: 36rpx 34rpx calc(34rpx);
  animation: popIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.28);
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { from { transform: scale(0.86); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ===================================================================
 * 入场动画
 *
 * 踩过的两个坑，改之前务必看懂：
 *  1. 整页不做动画。uni-app 缓存页面，切换 tab 时页面整体做位移/透明度过渡，
 *     观感就是"屏幕晃/闪"，所以动画只放在内容层（.fade-row）。
 *  2. 重播不能靠"关掉动画再打开"。那种做法在页面已可见时必然产生
 *     「内容完整显示 → 突然消失 → 再淡入」的两段跳变＝闪一下。
 *     正确做法是重建内容节点（见 useEnterAnim 的 animKey），新旧节点在同一帧交替，
 *     动画从头播放且不会被打断。
 * =================================================================== */
/*
 * 入场动画（柔和版）。
 *
 * 三个必须遵守的约束，都是踩过的坑：
 *  1. 整页不做动画。uni-app 会缓存 tab 页（实测切换后页面根节点仍在），
 *     整屏做位移/透明度过渡，观感就是"屏幕晃/闪"。
 *  2. 起点透明度不要用 0。切页时页面是缓存的、已经完整可见，若从 0 开始，
 *     一旦动画起始帧晚于页面显示一帧，就会出现「亮 → 全暗 → 再亮」的闪一下。
 *     从 0.5 起跳即使慢半帧也只是轻微变暗，不会被感知成闪烁。
 *  3. 位移距离要小：列表项用 14rpx 的轻微下沉，块级卡片用 22rpx 的横向轻推，
 *     大距离滑入在反复切 tab 时会变成"弹幕"，非常吵。
 */
.fade-row { animation: rowIn 0.5s cubic-bezier(0.22, 0.75, 0.28, 1) both; }
@keyframes rowIn {
  from { opacity: 0.5; transform: translateY(14rpx); }
  to { opacity: 1; transform: none; }
}

.slide-in-left { animation: slideInLeft 0.52s cubic-bezier(0.22, 0.75, 0.28, 1) both; }
@keyframes slideInLeft {
  from { opacity: 0.5; transform: translateX(-22rpx); }
  to { opacity: 1; transform: none; }
}

/* ===================================================================
 * 统一页面骨架：待办 / 统计 / 我的 —— 三个 tab 页共用同一套布局逻辑
 *
 *   .screen.t-page            固定高度容器（已扣掉 tabBar）
 *     ├─ .t-hero              顶部区（状态栏内边距由页面传 statusBarH）
 *     └─ scroll-view.t-body   内容区（内滚，flex:1 自动占满剩余高度）
 *
 * 为什么要有 .t-page：uni-app 的页面容器高度是 100vh，而 tabBar 是叠在底部的，
 * 所以直接 100vh 会让内容区底部被底栏遮挡（实测被挡 34px），
 * 各页原先只好写 calc(100vh - 190rpx / 200rpx) 硬凑。
 * 现在高度只在这里算一次，页面里不再出现任何 vh 魔法数字。
 * ⚠️ 若改了 pages.json 里 tabBar 的 height，这里的 --t-tabbar-h 要同步。
 * =================================================================== */
:root { --t-tabbar-h: 0px; }
/* #ifdef H5 */
/* H5 的页面容器包含 tabBar 区域（实测 pageBody=100vh、可见区=100vh-52px），需要扣除 */
:root { --t-tabbar-h: calc(52px + env(safe-area-inset-bottom, 0px)); }
/* #endif */

.screen.t-page {
  height: calc(100vh - var(--t-tabbar-h, 0px));
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* 顶部区：默认"浅色渐变 + 深色标题"，加 .bold 变成"主题渐变 + 白字"（我的页用） */
.t-hero {
  flex-shrink: 0;
  padding: 14rpx 30rpx 20rpx;
  background: linear-gradient(180deg, var(--p-light, #f7c1cf) 0%, var(--p-bg, #fbf3f3) 100%);
}
.t-hero.bold {
  border-radius: 0 0 30rpx 30rpx;
  background: var(--p-grad, linear-gradient(135deg, #f4708b, #d8415d));
  color: #fff;
}
.t-hero-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }
.t-hero-title { font-size: 40rpx; font-weight: 800; color: var(--p-deep, #7a2b3c); }
.t-hero.bold .t-hero-title { color: #fff; }
.t-hero-sub { display: block; font-size: 20rpx; opacity: 0.75; margin-top: 4rpx; }
.t-hero-icons { display: flex; align-items: center; gap: 22rpx; font-size: 34rpx; color: var(--p-primary, #e53935); }
.t-hero.bold .t-hero-icons { color: #fff; }

/* 内容区：flex:1 + min-height:0 才能在 flex 容器里正确内滚 */
.t-body { flex: 1; min-height: 0; }

/* 统一的卡片 / 区块标题 / 列表行 */
.t-card {
  margin: 18rpx 24rpx;
  padding: 26rpx;
  background: var(--p-card, #fff);
  border-radius: 28rpx;
  box-shadow: var(--p-shadow, 0 6rpx 24rpx rgba(40, 20, 10, 0.05));
}
/* 包裹"若干行"的卡片：行自带上下内边距，卡片改用更小的纵向内边距 */
.t-card.tight { padding: 2rpx 26rpx; }
.t-section-title { font-size: 30rpx; font-weight: 800; color: var(--p-primary, #e53935); }
.t-row { display: flex; align-items: center; gap: 18rpx; padding: 26rpx 0; }
.t-row:not(:first-child) { border-top: 2rpx solid var(--p-border, #f3f4f7); }
.t-row-icon { flex-shrink: 0; width: 46rpx; text-align: center; font-size: 36rpx; }
.t-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.t-row-title { font-size: 30rpx; }
.t-row-desc { font-size: 22rpx; color: var(--p-sub, #999); margin-top: 4rpx; }
.t-bottom-space { flex-shrink: 0; height: 60rpx; }

/* ===================================================================
 * 宽屏适配（平板 / 横屏 / 桌面）
 *
 * 判定由 useResponsive 加在页面根节点上。为什么不用 @media：
 * 鸿蒙渲染层（uni-app-harmony-framework）里没有 matchMedia，媒体查询不生效，
 * 而 getSystemInfoSync / onWindowResize 在 H5、App、鸿蒙上都可用。
 *
 * 尺寸换算参考：宽屏下 rpx 基准被锁到 480（pages.json），
 * 即 1rpx ≈ 0.64px —— 1320rpx ≈ 845px、1400rpx ≈ 896px。
 * =================================================================== */

/*
 * 内容居中限宽。
 * 不加这条的话，平板横屏（1280px）下卡片会被拉到满宽，一行近百字，非常难读。
 */
.is-wide .t-card,
.is-wide .card,
.is-wide .total-card,
.is-wide .exam-card,
.is-wide .ov-strip,
.is-wide .grid-card,
.is-wide .stat-strip {
  max-width: 1320rpx;
  margin-left: auto;
  margin-right: auto;
}
/*
 * 列表类元素（待办卡片、记录行、考研卡、概览条）的居中限宽。
 * 这些元素在页面里大多有自己的 scoped margin（scoped 属性选择器优先级更高、
 * 且加载在 App.vue 之后），所以这里要用 !important 才能赢——
 * 它们都不在 .t-flow 两栏容器里，不会和两栏布局的 margin 冲突。
 */
.is-wide .todo,
.is-wide .rec,
.is-wide .exam-card,
.is-wide .ov-strip,
.is-wide .list,
.is-wide .rec-list {
  max-width: 1240rpx;
  margin-left: auto !important;
  margin-right: auto !important;
}

/*
 * 平板观感：大屏上放大圆角与留白。
 * 不做这一步的话，界面会像是"手机界面被拉宽"，而不是为平板设计的。
 */
.is-wide .t-card,
.is-wide .card {
  border-radius: 36rpx;
  padding: 32rpx;
}
.is-wide .t-card.tight { padding: 2rpx 32rpx; }
.is-wide .t-hero { padding-bottom: 26rpx; }
.is-wide .t-hero-title { font-size: 46rpx; }
.is-wide .t-hero-sub { font-size: 24rpx; }
.is-wide .t-section-title { font-size: 34rpx; }
.is-wide .t-row { padding: 30rpx 0; }
.is-wide .t-row-title { font-size: 32rpx; }
.is-wide .t-row-desc { font-size: 24rpx; }

/*
 * 两栏（.is-2col，窗口 ≥1000px）：
 * 把卡片按两列排布，用满平板的横向空间。
 * 宽度必须给余量：算到正好 100% 时亚像素舍入会偶发换行（踩过），
 * 留 32rpx 余量后由 justify-content: center 居中，列间距仍是两卡各自的 24rpx 外边距。
 * 若某平台不支持 calc，会退化成两列紧贴，仍可正常使用。
 */
.is-2col .t-flow {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 1560rpx;
  margin-left: auto;
  margin-right: auto;
}
.is-2col .t-flow > .t-card,
.is-2col .t-flow > .total-card {
  /* 卡片默认 content-box，padding 不算在宽度里，两列会超出容器又被挤换行 */
  box-sizing: border-box;
  width: calc(50% - 64rpx);
  margin: 18rpx 24rpx;
}

/*
 * 横屏：纵向空间紧张，收紧顶部留白、给底部留出更多内容高度；
 * 同时避开刘海/挖孔侧的安全区。
 */
.screen.is-landscape {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
.screen.is-landscape .t-hero { padding-top: 6rpx; padding-bottom: 12rpx; }
.screen.is-landscape .t-hero-title { font-size: 34rpx; }
.screen.is-landscape .t-hero-sub { font-size: 20rpx; }
.screen.is-landscape .t-bottom-space { height: 32rpx; }
/* 横屏高度小，弹层若超高会让底部按钮点不到，改为内部滚动 */
.screen.is-landscape .pop-card { max-height: 84vh; overflow-y: auto; }

/*
 * 入场动画节流：长列表只让前若干项播动画（页面按索引加 .no-enter）。
 * 上百个元素同时做透明度动画会让切页明显掉帧，尤其是平板的大屏。
 */
.no-enter { animation: none !important; }

/*
 * 按压反馈（对应官方「按压弹性反馈」）：
 * 用带过冲的曲线（末段 >1），松手时会回弹一下，而不是生硬地弹回。
 */
.press {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.42, 0.64, 1),
    opacity 0.2s ease,
    box-shadow 0.2s ease;
}
.press:active {
  transform: scale(0.955);
  opacity: 0.92;
  /* 按压点光源（简化版）：整块泛起内发光。
     真正的"光随指动"要 ArkUI 的 LightComponent，uni-app 的 CSS 层拿不到。 */
  box-shadow:
    var(--p-shadow, 0 8rpx 24rpx rgba(40, 20, 10, 0.05)),
    inset 0 0 60rpx rgba(255, 255, 255, 0.5);
}

/* ===================================================================
 * 毛玻璃（液态玻璃）
 *
 * 配方：半透明底色 + 背景模糊 + 提高饱和度 + 顶部 1rpx 高光描边。
 *
 * 两条必须注意的坑（都踩过）：
 *  1. 条件里必须写 px、不能写 rpx：@supports 的条件值不走 uni-app 的 rpx 转换，
 *     写 blur(2rpx) 会被判为无效值，整块直接失效。
 *  2. 这段必须放在 .t-card/.card 定义之后：同优先级下后面的规则赢，
 *     放在前面会被骨架里的 background: var(--p-card) 覆盖，玻璃就没了。
 *
 * 底色刻意取 0.72 / 0.86 而不是 0.5 —— 万一模糊没生效（@supports 失效），
 * 半透明 + 无模糊会让文字压在海报纸纹上看不清。
 * =================================================================== */
@supports (backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px)) {
  .t-card,
  .card,
  .glass {
    background-color: var(--p-glass, rgba(255, 255, 255, 0.72));
    /* 材质流光：左上到右下一道斜向高光，模拟玻璃表面的反光（纯渐变，零成本） */
    background-image: var(
      --p-sheen,
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.55) 0%,
        rgba(255, 255, 255, 0.08) 30%,
        rgba(255, 255, 255, 0) 52%
      )
    );
    /*
     * 模糊半径压到 14rpx：带 backdrop-filter 的元素在滚动/动画时每帧都要重算模糊，
     * 平板上列表达到几十个就会掉帧。视觉上 14rpx 已经足够通透，
     * 剩下的"玻璃感"交给上面的流光和下面的折射高光（都是零成本）。
     */
    backdrop-filter: blur(14rpx) saturate(140%);
    -webkit-backdrop-filter: blur(14rpx) saturate(140%);
    border: 1rpx solid var(--p-glass-line, rgba(255, 255, 255, 0.75));
    /* 折射：上缘提亮、下缘压暗，让卡片像有厚度的玻璃，而不是一块半透明色块 */
    box-shadow:
      var(--p-shadow, 0 8rpx 24rpx rgba(40, 20, 10, 0.05)),
      inset 0 2rpx 0 rgba(255, 255, 255, 0.6),
      inset 0 -2rpx 0 rgba(255, 255, 255, 0.22);
  }

  /* 弹层：更实一点的玻璃，保证正文可读 */
  .pop-card {
    background: var(--p-glass-strong, rgba(255, 255, 255, 0.86));
    backdrop-filter: blur(40rpx) saturate(160%);
    -webkit-backdrop-filter: blur(40rpx) saturate(160%);
    border: 1rpx solid var(--p-glass-line, rgba(255, 255, 255, 0.75));
  }

  /* 遮罩：把整页虚化，弹层浮在虚化背景上（只在弹层打开时才会有这层开销） */
  .pop-mask {
    background: rgba(15, 10, 8, 0.3);
    backdrop-filter: blur(8rpx);
    -webkit-backdrop-filter: blur(8rpx);
  }
}
</style>
