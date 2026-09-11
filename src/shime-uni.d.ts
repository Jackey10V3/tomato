// uni-app 全局生命周期注入到 Vue 组件实例的声明
export {}
declare module 'vue' {
  interface ComponentCustomOptions {
    onLaunch?: (options?: unknown) => void
    onShow?: (options?: unknown) => void
    onHide?: () => void
    onLoad?: (query?: Record<string, string | undefined>) => void
    onReady?: () => void
    onUnload?: () => void
  }
}
