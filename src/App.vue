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
.fade-row { animation: rowIn 0.42s cubic-bezier(0.22, 0.8, 0.3, 1) both; }
@keyframes rowIn {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: none; }
}

/*
 * 从左侧滑入（块级卡片用）。
 * 距离刻意压到 40rpx（约 20px）而不是从屏幕外飞进来：
 *  - 横向位移在移动端代表"层级导航"，整屏距离放进内容层会让用户误以为卡片来自上一页；
 *  - 列表一多，长距离滑入会变成弹幕式连发，反复切换 tab 时很吵。
 * 想要"整屏飞入"的效果，把 translateX 改成 -100% 即可（不推荐用在长列表上）。
 */
.slide-in-left { animation: slideInLeft 0.46s cubic-bezier(0.22, 0.8, 0.3, 1) both; }
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-40rpx); }
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

/* 可点击元素的按压反馈 */
.press { transition: transform 0.12s ease, opacity 0.12s ease; }
.press:active { transform: scale(0.975); opacity: 0.95; }
</style>
