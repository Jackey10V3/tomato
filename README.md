# 🍅 番茄Todo

基于 **Uni-app（Vue3 + TypeScript + Vite）** 的安卓 / 鸿蒙双端时间管理与专注 App。
功能：番茄工作法计时、任务清单、专注统计、白噪音、线上自习室（WebSocket）。

架构与实现细节见 [`番茄Todo-双端开发设计方案.md`](./番茄Todo-双端开发设计方案.md)。

## 目录结构

```
├── src/                  # Uni-app 前端工程
│   ├── api/              #   REST / WebSocket 接口封装
│   ├── components/       #   业务组件
│   ├── composables/      #   跨端核心逻辑（番茄钟状态机等）
│   ├── pages/            #   页面
│   ├── platform/         #   平台适配层（条件编译唯一出口）
│   ├── store/            #   Pinia
│   ├── static/           #   静态资源（tab 图标、白噪音音频等，待补充）
│   ├── types/            #   TS 类型
│   ├── utils/            #   工具
│   └── manifest.json / pages.json
├── server/               # Node.js + Express + MongoDB + WebSocket 后端
└── harmony-configs/      # ⚠ 首次在 HBuilderX「运行到鸿蒙」时自动生成
                          #   （权限 module.json5 需手动补充，见设计方案 4.3）
```

## 快速开始

### 前端（H5 / 微信小程序 / 鸿蒙小程序）

```bash
npm install
npm run dev:h5          # H5 调试
npm run build:h5        # H5 构建
npm run dev:mp-weixin   # 微信开发者工具
```

> **安卓 App 与鸿蒙原生 App 需要 HBuilderX**：
> 用 HBuilderX 打开本目录 → 运行到手机/模拟器（安卓）或「运行到鸿蒙」。
> 首次编译鸿蒙会自动生成 `harmony-configs/`，随后按设计方案 4.3 手动补充
> `ohos.permission.KEEP_BACKGROUND_RUNNING` 等权限。
> 原生能力（安卓前台服务保活、鸿蒙长时任务、本地通知）需按设计方案 4.4 以
> **uts 插件 / 原生插件** 方式接入，当前骨架中对应调用点为 `src/platform/*`。

### 后端

```bash
cd server
npm install
cp .env.example .env    # 配置 MONGODB_URI / JWT_SECRET
npm run dev             # tsx watch，默认 http://127.0.0.1:3000
```

## 约定

- 页面与 store 不直接写平台分支，一律收敛到 `src/platform/`；
- 番茄钟使用绝对时间戳驱动（`src/composables/usePomodoro.ts`）；
- 任务本地优先存储（`src/utils/storage.ts`，KV 封装可替换 SQLite），登录后增量同步。

## 待办（开发 Roadmap 详见设计方案第 5 章）

- [ ] tabBar / 启动图标与静态资源（static/ 目前为空）
- [ ] 原生前台服务 / 长时任务 uts 插件
- [ ] 白噪音音频资源与后台播放
- [ ] 自习室房间与 WebSocket 联调
- [ ] 鸿蒙 `harmony-configs` 权限配置与真机联调
