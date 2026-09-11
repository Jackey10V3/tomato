# 番茄Todo · 安卓 / 鸿蒙双端 Uni-app 架构设计方案

> 对应需求文档：`code (1).md`（番茄工作法 + 任务清单 + 数据统计 + 白噪音 + 在线自习室）
> 技术栈：Uni-app（Vue3 + TS + Vite）· uView Plus · Pinia · Node.js/Express + MongoDB · WebSocket
> 本方案按交付物要求输出：① 目录结构 ② 数据库 Schema ③ 核心代码实现 ④ 双端打包 Roadmap，并在开头给出对需求文档的技术性修正与平台现状说明。

---

## 0. 前置说明（重要）

### 0.1 需求文档中的两处技术性修正

1. **`uni.createKeepAliveScreen()` 并非官方 API**。阻止屏幕息屏的标准 API 是：
   `uni.setKeepScreenOn({ keepScreenOn: true })`（或 `plus.screen` 系）。且它**只能防止"前台息屏"**，
   **不能**让 App 退到后台后计时不中断——后台计时必须依赖原生前台服务 / 鸿蒙长时任务（见 0.2 与 4.5）。
2. **鸿蒙"长时任务"不是申请一个权限就永久保活**。鸿蒙要求：任务类型与实际场景匹配（如真的在播放音频才可申请 `AUDIO_PLAYBACK`）、运行期间通知栏常驻、且上架审核会核对使用场景。计时器若无声音陪伴，纯后台计时在鸿蒙没有 100% 保证，必须做"时间戳驱动 + 恢复校准"兜底（见 4.1）。

### 0.2 双端支持现状（决定整个方案的前提）

| 路线 | 说明 | 适用 |
|---|---|---|
| **经典 uni-app（Vue3）→ Harmony** | HBuilderX 4.2x 起支持 Vue3 工程编译到鸿蒙平台；鸿蒙工程（含 `harmony-configs` 权限目录）在首次编译时自动生成，产物为 ArkTS 工程，需本地安装 **DevEco Studio** 出包（鸿蒙无云打包、早期无热刷新） | 已有 Vue3 工程，低成本接入鸿蒙（当前需求文档即假设此路线） |
| **uni-app x（4.61+）→ Harmony NEXT** | 组件/API/CSS 与安卓、iOS 对齐更好，产物为纯 ArkTS 原生应用，性能与 API 覆盖面最优 | 新立项、追求双端原生级体验时建议评估 |

> 关键条件编译语义变化：鸿蒙加入后，`APP-PLUS` **不再命中鸿蒙**（仅安卓/iOS）；
> **`APP` = 安卓 + iOS + 鸿蒙**；**`APP-HARMONY` = 仅鸿蒙**。
> 老代码里凡是"想覆盖安卓+鸿蒙"却写 `#ifdef APP-PLUS` 的地方，都要按此修正（见第 5 章风险清单 R1）。

参考：[uni-app x Harmony 开发指南](https://doc.dcloud.net.cn/uni-app-x/app-harmony/) · [uni-app 对鸿蒙的支持现状](https://cloud.tencent.cn/developer/article/2520133?from=15425&frompage=seopage) · [鸿蒙平台条件编译（APP-HARMONY / APP / APP-PLUS）](https://blog.csdn.net/weixin_45822171/article/details/149517344) · [鸿蒙后台任务（长时任务 continuousTask）](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/continuous-task) · [KEEP_BACKGROUND_RUNNING 保活与受限场景讨论](https://developer.huawei.com.cn/consumer/cn/forum/topic/0201219445463772217)

---

## 1. 总体架构

### 1.1 分层与职责

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层   pages/*（vue 页面）+ components/*（uview-plus）      │
├─────────────────────────────────────────────────────────────┤
│  状态层   Pinia store（task / pomodoro / stats / room / user）│
├─────────────────────────────────────────────────────────────┤
│  业务层   composables/*（可复用逻辑，与平台无关的核心在此）      │
│           usePomodoro / useTask / useWhiteNoise / useRoom     │
├─────────────────────────────────────────────────────────────┤
│  能力适配层  platform/*（条件编译唯一出口：常亮/保活/通知/权限/  │
│             防打扰/音频焦点 —— 页面与 store 绝不直接写 #ifdef）│
├─────────────────────────────────────────────────────────────┤
│  基础设施  utils/（storage、date、sync、ws 客户端）            │
│           api/（REST 封装）→ Node.js + Express + MongoDB      │
├─────────────────────────────────────────────────────────────┤
│  原生层    uts 插件 / 原生插件（Android 前台服务、Harmony 长时  │
│            任务、本地通知、音频后台播放）                       │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：
1. **计时是数学问题，不是定时器问题**——番茄钟核心用"绝对时间戳差"计算剩余，`setInterval` 只负责刷新 UI；
2. **平台差异全部收敛到 `platform/*` 适配层**，页面与业务 composable 里不出现平台分支，只有 `#ifdef` 出现在适配层内部；
3. 本地优先（离线可用）→ 登录后增量同步（见 3.3）。

### 1.2 六大需求 → 实现落点速查

| # | 需求 | 前端落点 | 双端策略 |
|---|---|---|---|
| 1 | 任务管理 | `pages/task/*` + `store/task` + `useTask` | 本地 KV 持久化（封装可换 SQLite）→ 登录后增量云同步 |
| 2 | 番茄钟计时 | `composables/usePomodoro` + `pages/focus` | 时间戳驱动核心（跨端一致）；安卓：前台服务保活；鸿蒙：长时任务 + 持续通知 |
| 3 | 专注防打扰 | `pages/mine/permission-guide` + `platform/focus-guard` | 安卓：引导悬浮窗/使用情况访问权限，检测娱乐 App；鸿蒙：无第三方可见性 → 降级为"免打扰通知引导 + 沉浸式自控"，如实提示用户 |
| 4 | 白噪音 | `composables/useWhiteNoise` + `platform/audio` | 安卓：前台服务 + AudioFocus + MediaSession；鸿蒙：AUDIO_PLAYBACK 长时任务（有音播放天然合规） |
| 5 | 统计可视化 | `pages/stats` + qiun-data-charts(uCharts) | 服务端聚合专注时长 → 热力图 + 周/月报表 |
| 6 | 在线自习室 | `pages/room/*` + `useRoom` | WebSocket 房间、presence（专注中/休息中）、弹幕/表情 |

---

## 2. 项目目录结构设计

```
tomato/
├── src/
│   ├── api/                        # 服务端接口封装（axios/uni.request）
│   │   ├── http.ts                 #   请求实例、token 注入、401 刷新
│   │   ├── auth.ts  task.ts  focus.ts  stats.ts  room.ts
│   │   └── ws.ts                   #   WebSocket 客户端（重连/心跳）
│   ├── components/                 # 业务组件（uview-plus 之上封装）
│   │   ├── TaskItem.vue  TagSelect.vue  PriorityBadge.vue
│   │   ├── TimerRing.vue           #   番茄钟圆环进度
│   │   ├── NoisePlayer.vue         #   白噪音选择面板
│   │   ├── Heatmap.vue             #   专注热力图(uCharts 封装)
│   │   └── RoomStatusBar.vue       #   自习室在线成员状态
│   ├── composables/                # ★ 跨端核心业务逻辑（与平台无关）
│   │   ├── usePomodoro.ts          #   ★ 番茄钟状态机（见 4.1）
│   │   ├── useTask.ts  useSync.ts
│   │   ├── useWhiteNoise.ts  useRoom.ts
│   ├── platform/                   # ★ 平台适配层（#ifdef 只允许出现在这里）
│   │   ├── index.ts                #   统一出口 platform.xxx
│   │   ├── keepAlive.ts            #   常亮 / 保活服务启停
│   │   ├── notify.ts               #   本地通知（进度/完成提醒）
│   │   ├── permission.ts           #   权限申请与引导跳转
│   │   ├── focusGuard.ts           #   专注防打扰（安卓检测/鸿蒙降级）
│   │   ├── audio.ts                #   音频焦点 / 后台播放会话
│   ├── pages/                      # 页面（对应 pages.json）
│   │   ├── focus/index.vue         #   专注页（番茄钟大圆环）
│   │   ├── task/index.vue          #   ★ 任务列表（见 4.6）
│   │   ├── task/edit.vue           #   新建/编辑任务（弹层或独立页）
│   │   ├── stats/index.vue         #   数据统计（热力图+周月报表）
│   │   ├── room/index.vue          #   自习室列表
│   │   ├── room/detail.vue         #   自习室房间（presence+弹幕）
│   │   ├── login/index.vue
│   │   └── mine/  index.vue        #   我的
│   │        ├── permission-guide.vue   #   权限引导页（悬浮窗/通知/电量白名单）
│   │        └── settings.vue
│   ├── static/                     # logo、tab 图标、白噪音音频源
│   │   └── audio/{rain,forest,library}.mp3
│   ├── store/                      # Pinia
│   │   ├── index.ts
│   │   └── modules/ user.ts task.ts pomodoro.ts stats.ts room.ts settings.ts
│   ├── types/                      # TS 类型与 Schema 对应
│   │   ├── task.ts  pomodoro.ts  room.ts  api.ts
│   ├── utils/
│   │   ├── storage.ts              #   本地持久化封装（KV；可整体替换 SQLite）
│   │   ├── date.ts  uuid.ts  sync.ts
│   │   └── constant.ts             #   默认时长/标签色板/优先级枚举
│   ├── uni_modules/                # uview-plus、qiun-data-charts、z-paging、
│   │                               # 番茄钟原生插件(uts)等
│   ├── styles/  App.vue  main.ts
│   ├── pages.json                  # 路由 + tabBar + 导航样式
│   ├── manifest.json               # ★ 应用配置 + 权限（见 4.2）
│   └── uni.scss
├── harmony-configs/                # ⚠ 首次“运行到鸿蒙”自动生成
│   └── entry/src/main/             #   鸿蒙权限在此配置（module.json5，见 4.3）
│       ├── module.json5
│       └── resources/base/element/string.json
├── server/                         # 后端（独立仓库或子目录）
│   ├── src/
│   │   ├── app.ts                  #   Express 入口（CORS/鉴权中间件）
│   │   ├── models/                 #   user.ts task.ts focusRecord.ts room.ts
│   │   ├── controllers/  routes/
│   │   ├── ws/                     #   WebSocket：自习室 presence/弹幕
│   │   │   ├── index.ts  roomHub.ts
│   │   ├── services/stats.ts       #   热力图/周月聚合(aggregation)
│   │   └── config/  (env, mongodb 连接)
│   └── package.json
├── package.json  tsconfig.json  vite.config.ts  index.html
```

> 说明：
> - **不建 `hybrid/` 原生工程**：云打包路径下原生能力通过 **uts 插件 / uni_modules 原生插件** 注入；需要深度定制 AndroidManifest / 自签名时再切换到 **离线打包**（`nativeApp/android`），目录届时自动生成，此处不占位。
> - `harmony-configs` 目录需提交到 Git 并团队共享，因为签名、权限、包名都在里面。

---

## 3. 数据库设计（MongoDB，mongoose Schema 形式）

### 3.1 集合 Schema

```ts
// server/src/models/user.ts
export interface User {
  _id: ObjectId
  phone?: string            // 登录方式之一
  email?: string
  passwordHash?: string     // 或接入 OAuth/微信
  nickname: string
  avatar?: string
  settings: {               // 番茄配置随账号漫游
    focusMinutes: number        // 默认 25
    shortBreakMinutes: number   // 默认 5
    longBreakMinutes: number    // 默认 15
    roundsPerCycle: number      // 默认 4
    autoStartNext: boolean
    whiteNoise: 'rain' | 'forest' | 'library' | 'off'
  }
  createdAt: Date
  updatedAt: Date
}
// 索引：phone / email 唯一
```

```ts
// server/src/models/task.ts
export interface Task {
  _id: ObjectId
  userId: ObjectId          // 索引(userId, planDate, sortOrder)
  clientId: string          // 客户端生成的 UUID —— 离线创建去重的关键
  title: string
  notes?: string
  tags: string[]            // 标签（预置：工作/学习/生活…）
  priority: 0 | 1 | 2 | 3   // 0无 1低 2中 3高
  sortOrder: number         // 用于排序（前端拖拽后重排）
  planDate?: string         // 'YYYY-MM-DD'，可选
  estimatePomodoros?: number// 预估番茄数
  donePomodoros: number     // 已完成番茄数（统计/激励展示）
  completed: boolean
  completedAt?: Date
  deleted: boolean          // ★ 软删除，供同步
  createdAt: Date
  updatedAt: Date           // ★ 同步游标字段，服务端覆盖写
}
```

```ts
// server/src/models/focusRecord.ts —— 专注记录（统计的数据源）
export interface FocusRecord {
  _id: ObjectId
  userId: ObjectId          // 索引(userId, startedAt: -1)
  taskId?: ObjectId | null
  kind: 'focus' | 'break'
  phaseRound: number        // 本次是第几个专注（第 4 个后进入长休）
  plannedSec: number        // 计划时长（秒），如 1500
  actualSec: number         // 实际专注（秒）；中途放弃则 < plannedSec
  completed: boolean        // 是否完整跑完一个番茄
  abandonedReason?: 'manual_stop' | 'give_up' | 'app_killed'
  startedAt: Date
  endedAt: Date
  clientTime: Date          // 客户端时间（跨时区/校正用）
  createdAt: Date
}
```

```ts
// server/src/models/room.ts —— 自习室
export interface Room {
  _id: ObjectId
  name: string
  cover?: string
  ownerId: ObjectId
  maxMembers: number        // 默认 50
  status: 'open' | 'closed'
  createdAt: Date
  // 在线人数 = 实时统计（RoomHub 维护），不落库：
  //   onlineMembers: { userId, nickname, state: 'focus'|'break'|'idle', remainSec, joinedAt }
}

// 弹幕/表情：消息量大，建议独立集合 + TTL 索引自动清理
export interface RoomMessage {
  _id: ObjectId
  roomId: ObjectId          // 索引(roomId, createdAt: 1)
  userId: ObjectId
  kind: 'danmaku' | 'emoji' | 'system'
  content: string
  createdAt: Date           // TTL 索引：expireAfterSeconds: 3600
}
```

### 3.2 主要 REST 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/v1/auth/register · /login | 注册/登录，签发 JWT |
| GET/POST | /api/v1/tasks | 列表（?since= 增量） / 新建 |
| PUT/DELETE | /api/v1/tasks/:id | 更新 / 软删除 |
| GET/POST | /api/v1/focus-records | 新增专注记录 / 分页查询 |
| GET | /api/v1/stats/heatmap?from=&to= | 返回 `[{date:'YYYY-MM-DD', minutes}]` |
| GET | /api/v1/stats/report?range=week\|month | 周/月效率报表聚合 |
| GET | /api/v1/rooms | 房间列表 + 在线人数（ws 汇总） |
| WS | /ws/room/:roomId?token= | 房间实时通道 |

### 3.3 离线与同步策略（重点）

- 客户端每条记录带 `clientId`（UUID）+ `updatedAt`；**服务端 LWW（Last-Write-Wins）**覆盖写，`updatedAt` 新者胜，删除用 `deleted` 软删标记传播；
- 增量拉取：`GET /tasks?since=<本地游标>`，服务端按 `updatedAt > since` 返回；
- 冲突兜底：任务标题/正文以服务端为准；若两端同时修改，服务端版本胜出并在下次拉取时覆盖本地（对单用户清单场景足够，避免引入复杂 CRDT）；
- 专注记录**只增不改**，天然无冲突，离线期间暂存本地队列，联网后按序上报。

---

## 4. 核心功能代码实现

### 4.1 番茄钟核心逻辑 —— `composables/usePomodoro.ts`

设计要点：
- **`endAt`（绝对时间戳）驱动**：暂停时存 `remainingMs`，恢复时 `endAt = now + remainingMs`。即使进程被杀、JS 定时器在后台被冻结，恢复后依然准确；
- 快照写入 `uni.setStorageSync`（`utils/storage.ts` 封装，未来可无痛替换 SQLite）；
- 每次进入前台 / 应用启动时 `sync()` 校准，若发现"运行中但已超时"则视为后台自然完成，补齐记录与通知；
- 状态转换通过事件回调通知平台适配层（保活服务、通知栏进度）。

```ts
// src/types/pomodoro.ts
export type Phase = 'focus' | 'shortBreak' | 'longBreak'
export type Status = 'idle' | 'running' | 'paused'
export interface PomodoroConfig {
  focusMinutes: number; shortBreakMinutes: number
  longBreakMinutes: number; roundsPerCycle: number; autoStartNext: boolean
}
export interface Snapshot {
  phase: Phase
  status: Status
  round: number            // 当前/已完成的第几个专注
  endAt: number            // 本阶段结束时间戳(ms)；running 时有效
  remainingMs: number      // paused 时的剩余
  taskId: string | null
  focusStartedAt: number
  totalFocusSec: number    // 本阶段已累计专注秒（用于中途放弃记录）
}
```

```ts
// src/composables/usePomodoro.ts
import { computed, reactive, onUnmounted } from 'vue'
import { storage } from '@/utils/storage'
import { platform } from '@/platform'          // 常亮/保活/通知适配层
import type { Phase, Status, Snapshot, PomodoroConfig } from '@/types/pomodoro'
import { focusApi } from '@/api/focus'
import type { Task } from '@/types/task'

const KEY = 'tomato:pomodoro:snapshot:v1'
const DEFAULTS: PomodoroConfig = {
  focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15,
  roundsPerCycle: 4, autoStartNext: true,
}

const nextPhase = (phase: Phase, round: number, cfg: PomodoroConfig): Phase => {
  if (phase !== 'focus') return 'focus'
  return round % cfg.roundsPerCycle === 0 ? 'longBreak' : 'shortBreak'
}
const phaseMs = (phase: Phase, cfg: PomodoroConfig) =>
  phase === 'focus' ? cfg.focusMinutes
    : phase === 'shortBreak' ? cfg.shortBreakMinutes : cfg.longBreakMinutes

export function usePomodoro(config: Partial<PomodoroConfig> = {}) {
  const cfg = reactive<PomodoroConfig>({ ...DEFAULTS, ...config })

  const s = reactive<Snapshot>({
    phase: 'focus', status: 'idle', round: 0, endAt: 0, remainingMs: 0,
    taskId: null, focusStartedAt: 0, totalFocusSec: 0,
  })

  const listeners: Record<string, ((p: Snapshot, ...a: any[]) => void)[]> = {}
  const on = (ev: string, fn: (p: Snapshot, ...a: any[]) => void) =>
    ((listeners[ev] ??= []).push(fn))
  const emit = (ev: string, ...a: any[]) =>
    (listeners[ev] ?? []).forEach(fn => fn({ ...s }, ...a))

  const persist = () => storage.set(KEY, JSON.stringify(s))
  const phaseDurationSec = () => phaseMs(s.phase, cfg) * 60

  // ---------- 纯状态迁移（可在单测中直接调用） ----------
  const enter = (phase: Phase, round: number, autoStart = true) => {
    s.phase = phase; s.round = round
    s.status = 'idle'; s.endAt = 0; s.remainingMs = 0   // 先复位再启动
    s.totalFocusSec = 0
    if (autoStart) start()
    persist(); emit('phaseChange', s)
    platform.onPhaseChange(s)          // 同步原生保活服务/通知
  }

  function start() {
    if (s.status === 'running') return
    const remain = s.status === 'paused' ? s.remainingMs : phaseDurationSec() * 1000
    s.remainingMs = 0
    s.endAt = Date.now() + remain
    s.status = 'running'
    if (s.phase === 'focus') s.focusStartedAt = Date.now()  // 本运行段起点（用于累计）
    persist(); emit('start', s)
    platform.onPhaseChange(s)          // 安卓：拉起前台服务；鸿蒙：续长时任务
  }
  function pause() {
    if (s.status !== 'running') return
    s.remainingMs = Math.max(0, s.endAt - Date.now())
    s.status = 'paused'; s.endAt = 0
    if (s.phase === 'focus' && s.focusStartedAt) {
      s.totalFocusSec += Math.round((Date.now() - s.focusStartedAt) / 1000)
      s.focusStartedAt = 0            // 段累计入账后清零，避免 resume 后重复累计
    }
    persist(); emit('pause', s); platform.onPhaseChange(s)
  }
  /** 手动放弃当前番茄（不记完成）；running/paused 均支持 */
  function giveUp() {
    const runningFocus = s.phase === 'focus' && s.status === 'running'
    const sec = s.totalFocusSec +
      (runningFocus && s.focusStartedAt
        ? Math.round((Date.now() - s.focusStartedAt) / 1000) : 0)
    if (s.phase === 'focus') {
      focusApi.record({ kind: 'focus', actualSec: sec, completed: false,
        abandonedReason: 'give_up', taskId: s.taskId }).catch(() => {})
    }
    s.status = 'idle'; s.endAt = 0; s.remainingMs = 0
    s.totalFocusSec = 0; s.focusStartedAt = 0; s.taskId = null
    persist(); emit('giveUp', s); platform.onPhaseChange(s)
  }

  async function complete() {          // 阶段自然结束
    const finishedPhase = s.phase
    if (finishedPhase === 'focus') {
      await focusApi.record({ kind: 'focus', plannedSec: phaseDurationSec(),
        actualSec: phaseDurationSec(), completed: true, taskId: s.taskId })
      emit('focusDone', s)             // 页面震动/提示；通知栏点击唤起
    }
    const newRound = finishedPhase === 'focus' ? s.round + 1 : s.round
    const np = nextPhase(finishedPhase, s.round, cfg)
    s.taskId = null
    emit('phaseDone', { ...s, phase: finishedPhase })
    enter(np, finishedPhase === 'focus' ? newRound : s.round, cfg.autoStartNext)
  }

  // ---------- 时钟：只负责“校对”，绝不累减 ----------
  let timer: ReturnType<typeof setInterval> | null = null
  const tick = () => {
    if (s.status !== 'running') return
    const remain = s.endAt - Date.now()
    if (remain <= 0) return complete()          // async 安全：内部先复位
    emit('tick', s)                              // 页面可自行订阅刷新
  }
  const startClock = () => { timer ??= setInterval(tick, 500) }
  const stopClock  = () => { if (timer) { clearInterval(timer); timer = null } }

  // ---------- 恢复 / 校准（App 启动 & 切前台时调用） ----------
  function restore() {
    const raw = storage.get<string>(KEY)
    if (!raw) return
    try { Object.assign(s, JSON.parse(raw)) } catch { storage.remove(KEY); return }
    if (s.status === 'running') {
      // 进程存活期间后台由原生服务兜底；这里校准一次真实时间
      const remain = s.endAt - Date.now()
      if (remain <= 0) complete()                // 后台自然完成 → 补记
      else startClock()
    }
    emit('restore', s)
  }
  function syncOnForeground() {                 // App.onShow / 页面 onShow 调用
    if (s.status === 'running') tick()
    else startClock()
  }

  /** 绑定一个任务开始专注 */
  function startWithTask(task: Task | null) {
    s.taskId = task?._id ?? null
    enter('focus', s.round + 1, true)
  }

  const remainingMs = computed(() =>
    s.status === 'running' ? Math.max(0, s.endAt - Date.now()) : s.remainingMs)
  const progress = computed(() =>
    remainingMs.value > 0 ? 1 - remainingMs.value / (phaseDurationSec() * 1000) : 0)

  restore()
  onUnmounted(stopClock)

  return { s, cfg, remainingMs, progress, start, pause, giveUp, complete,
    startWithTask, enter, restore, syncOnForeground, on }
}
```

**页面用法（`pages/focus/index.vue` 片段）**：

```vue
<script setup lang="ts">
import { usePomodoro } from '@/composables/usePomodoro'
const pomo = usePomodoro()
pomo.on('phaseChange', () => { uni.vibrateLong(); platform.refreshNotification(pomo.s) })
</script>
<template>
  <view class="ring-wrap">
    <TimerRing :progress="pomo.progress" :remain="pomo.remainingMs" :phase="pomo.s.phase" />
    <!-- 25/5/15 快捷配置、开始/暂停/放弃按钮；绑定 pomo.start/pause/giveUp -->
  </view>
</template>
```

### 4.2 应用权限配置 —— `manifest.json`

> HBuilderX 的 `manifest.json` 允许 `//` 注释。安卓权限写进
> `app-plus.distribute.android.permissions`（云打包会合入 AndroidManifest）；
> 运行时高危权限仍需代码申请（见下方 `platform/permission.ts`）。
> **鸿蒙权限不在此文件**，而在 `harmony-configs/…/module.json5`（见 4.3）。

```jsonc
{
  "name": "番茄Todo",
  "appid": "__UNI__XXXXXXXX",
  "description": "番茄工作法 + 任务清单 + 专注统计 + 白噪音 + 自习室",
  "versionName": "0.1.0",
  "versionCode": "100",
  "vueVersion": "3",
  "locale": "zh-Hans",
  "app-plus": {
    "usingComponents": true,
    "compilerVersion": 3,
    "distribute": {
      "android": {
        "minSdkVersion": 23,
        "targetSdkVersion": 34,
        "abiFilters": ["arm64-v8a"],
        "permissions": [
          "<uses-permission android:name=\"android.permission.INTERNET\"/>",
          "<uses-permission android:name=\"android.permission.VIBRATE\"/>",
          "<uses-permission android:name=\"android.permission.WAKE_LOCK\"/>",
          // ↓ 前台服务：专注计时 / 后台白噪音（specialUse 类型需在商店申报用途）
          "<uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\"/>",
          "<uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_SPECIAL_USE\"/>",
          // ↓ Android 13+ 通知（运行时申请）
          "<uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\"/>",
          // ↓ 防打扰：悬浮窗 / 使用情况访问（特殊授权，引导页跳系统设置）
          "<uses-permission android:name=\"android.permission.SYSTEM_ALERT_WINDOW\"/>",
          "<uses-permission android:name=\"android.permission.PACKAGE_USAGE_STATS\" tools:ignore=\"ProtectedPermissions\"/>",
          // ↓ 精确闹钟：任务提醒/专注结束兜底（Android 12+ 需申请或引导设置）
          "<uses-permission android:name=\"android.permission.SCHEDULE_EXACT_ALARM\"/>",
          // ↓ 引导用户忽略电池优化，降低后台被杀概率（引导页跳系统设置，勿静默申请）
          "<uses-permission android:name=\"android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS\"/>"
        ]
      },
      "ios": {},
      "splashscreen": { "alwaysShowBeforeRender": true, "autoclose": true }
    },
    "modules": {
      "Push": {},      // 本地/远程通知通道（uni-push 或自接厂商通道）
      "SQLite": {}     // 若任务量达万级可启用 plus.sqlite，见 utils/storage 注释
    }
  },
  "quickapp": {},
  "mp-weixin": {},
  "h5": {}
}
```

> ⚠ 云打包场景下**自定义 `service` 组件**（Android 前台服务类）不能只靠 manifest 声明，
> 需封装为 **uts 插件 / 原生插件**（`uni.requireNativePlugin`），或切 **离线打包** 直接改 AndroidManifest + Service 类。

### 4.3 鸿蒙权限配置 —— `harmony-configs/…/module.json5`

首次“运行到鸿蒙”后 HBuilderX 自动生成 `harmony-configs` 目录，**手动补充权限**（不随 API 自动打包）：

```json5
// harmony-configs/entry/src/main/module.json5
{
  module: {
    name: "entry",
    type: "entry",
    description: "$string:module_desc",
    mainElement: "EntryAbility",
    deviceTypes: ["phone", "tablet"],
    deliveryWithInstall: true,
    installationFree: false,
    pages: "$profile:main_pages",
    abilities: [ /* EntryAbility 等，自动生成，勿手改 */ ],
    requestPermissions: [
      { name: "ohos.permission.INTERNET" },
      {
        // 长时任务（后台计时/音频）：需与使用场景匹配，上架审核会核对
        name: "ohos.permission.KEEP_BACKGROUND_RUNNING",
        reason: "$string:keep_background_running_reason",   // 中文用途说明
        usedScene: { abilities: ["EntryAbility"], when: "inuse" }
      }
      // 受限(ACL)权限如 SYSTEM_FLOAT_WINDOW：需在 AGC 申请+审核，慎用；
      // 本方案鸿蒙防打扰不做悬浮窗监测，见 4.4 说明
    ]
  }
}
```

```json5
// harmony-configs/entry/src/main/resources/base/element/string.json（节选）
{
  "string": [
    { "name": "keep_background_running_reason",
      "value": "在专注计时与白噪音播放期间保持应用后台运行，用于按时提醒您休息并持续播放背景音" }
  ]
}
```

> 提醒：① 权限随签名证书绑定，**变更权限需更新证书**；② 真机调试需申请调试证书并绑定设备；③ 华为应用商店对长时任务类应用有专门合规审核（用途、时长、退出机制），详见鸿蒙官方《后台任务》文档。

### 4.4 平台适配层示例（含 `#ifdef` 条件编译）

```ts
// src/platform/index.ts —— 页面层唯一允许的平台分支出口
import { keepAlive } from './keepAlive'
import { notify } from './notify'

export const platform = {
  keepAlive,
  notify,
  /** 通知栏展示/更新当前阶段进度 */
  refreshNotification(s: { phase: string; endAt: number }) {
    if (s.endAt <= 0) return
    const remainMin = Math.ceil((s.endAt - Date.now()) / 60000)
    notify.show(s.phase === 'focus' ? '专注中' : '休息中', `剩余约 ${remainMin} 分钟`)
  },
  onPhaseChange(s: { phase: string; status: string }) {
    if (s.status === 'running') this.keepAlive.start(s)
    else this.keepAlive.stop(s)
  },
}
```

```ts
// src/platform/keepAlive.ts —— 常亮 + 保活服务
// #ifdef APP-PLUS   // 安卓/iOS（注：鸿蒙不命中 APP-PLUS！）
export const keepAlive = {
  start() {
    // ① 前台期间防息屏（需求文档所述 API 的官方实现）
    uni.setKeepScreenOn({ keepScreenOn: true })
    // ② 后台保活：调用原生前台服务插件（uts/原生插件封装 foreground service）
    const svc = uni.requireNativePlugin('Tomato-TimerService')
    svc.startTimer({ /* durationMs 由调用方传 endAt-now */ })
  },
  stop() {
    uni.setKeepScreenOn({ keepScreenOn: false })
    uni.requireNativePlugin('Tomato-TimerService').stopTimer()
  },
}
// #endif

// #ifdef APP-HARMONY  // 仅鸿蒙
export const keepAlive = {
  start() {
    // uts 插件内部：backgroundTaskManager.startBackgroundRunning(..., AUDIO_PLAYBACK)
    // + 通知常驻（持续通知），插件导出 HarmonyKeepAlive.start()
    HarmonyKeepAlive.startLongRunning()
  },
  stop() { HarmonyKeepAlive.stopLongRunning() },
}
// #endif
```

> 鸿蒙侧 uts 插件内示意（**以 DevEco/华为官方最新 API 为准**）：
> ```ts
> // tomato-harmony.uts（编译到 ArkTS）
> // API 12+ 推荐 kit 引入：import { backgroundTaskManager } from '@kit.BackgroundTasksKit'
> // 低版本兼容：import backgroundTaskManager from '@ohos.resourceschedule.backgroundTaskManager'
> export function startLongRunning(): void {
>   backgroundTaskManager.startBackgroundRunning(
>     /* context */ getContext(this),
>     backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK,
>     (err: Error) => { /* err.code 10199002 等需引导用户开启 */ })
> }
> ```

**运行时权限申请（Android 13+ 通知权限示例，`platform/permission.ts`）**：

```ts
// src/platform/permission.ts
// #ifdef APP-PLUS
export function ensureNotifyPermission(): Promise<boolean> {
  return new Promise(resolve => {
    plus.android.requestPermissions(
      ['android.permission.POST_NOTIFICATIONS'],
      () => resolve(true),
      () => resolve(false))
  })
}
// #endif
// #ifdef APP-HARMONY
export function ensureNotifyPermission(): Promise<boolean> {
  return HarmonyNotify.requestEnable().then(() => true).catch(() => false)
}
// #endif
```

**专注防打扰降级设计（`platform/focusGuard.ts`）**：
- 安卓：`SYSTEM_ALERT_WINDOW` + `PACKAGE_USAGE_STATS` 属特殊授权，**无法直接弹窗申请**，只能跳系统设置页——在 `permission-guide.vue` 中图文引导 + 检测回跳；专注期间轮询前台应用（`UsageStatsManager` 封装于原生插件），命中娱乐 App 白名单则提示；
- 鸿蒙：第三方应用**无法读取他应用使用情况/叠加全局悬浮窗**（隐私与 ACL 限制），如实降级为：系统"免打扰"引导 + 本地"禁止分心通知"策略 + 沉浸式 UI，并在产品说明中标注能力差异。

### 4.5 白噪音后台播放要点（`platform/audio.ts`）

- 安卓：`innerAudioContext` 切后台会被系统暂停，需**原生前台服务承载播放**并持有 `AudioManager.requestAudioFocus(AUDIOFOCUS_GAIN)`，接听电话/其他音频抢占时按 AudioFocus 回调暂停→恢复；
- 鸿蒙：白噪音播放即"有音场景"，配合 4.3 的 `AUDIO_PLAYBACK` 长时任务即合规可后台续播；注意系统音频会话被来电/闹钟打断时的状态恢复；
- 无声音时段（纯静音倒计时休息）后台不保证存活 → 依赖 4.1 的时间戳校准 + 结束本地通知兜底。

### 4.6 任务列表页 —— `pages/task/index.vue`

> 完整度：覆盖增删改查主流程 + 优先级/标签 + 完成态 + 本地持久化 + 云端同步触发入口。
> 拖拽排序建议引入 `u-drag-sort`（uView Plus 生态）后仅更新 `sortOrder`。

```vue
<!-- pages/task/index.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTaskStore } from '@/store/modules/task'
import { useSync } from '@/composables/useSync'
import TaskItem from '@/components/TaskItem.vue'
import type { Task } from '@/types/task'

const store = useTaskStore()
const sync = useSync()

const input = ref('')
const filter = ref<'all' | 'active' | 'done'>('all')
const activeTag = ref('')

const visibleTasks = computed(() => {
  let list = store.tasks
  if (filter.value === 'active') list = list.filter(t => !t.completed && !t.deleted)
  if (filter.value === 'done') list = list.filter(t => t.completed && !t.deleted)
  if (activeTag.value) list = list.filter(t => t.tags.includes(activeTag.value!))
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
})
const allTags = computed(() =>
  [...new Set(store.tasks.flatMap(t => t.tags))].slice(0, 8))

function addTask() {
  const title = input.value.trim()
  if (!title) return uni.showToast({ title: '请输入任务名', icon: 'none' })
  store.add({ title, tags: activeTag.value ? [activeTag.value] : [] })
  input.value = ''
}
function toggle(t: Task) { store.toggleCompleted(t) }      // 内部写本地 + 上报
function remove(t: Task) {
  uni.showModal({ title: '删除任务', content: `确定删除「${t.title}」？`,
    success: r => r.confirm && store.remove(t) })
}
function goFocus(t: Task) {
  uni.setStorageSync('tomato:pendingTask', JSON.stringify(t))
  uni.switchTab({ url: '/pages/focus/index' })             // 由 focus 页读取并 startWithTask
}
function openEdit(t: Task) {
  uni.navigateTo({ url: `/pages/task/edit?id=${t._id}` })
}
onMounted(() => { store.loadLocal(); sync.pullIfOnline() })
</script>

<template>
  <view class="page">
    <view class="add-bar">
      <input v-model="input" class="add-input" confirm-type="done"
             placeholder="添加一个任务，比如：写周报" @confirm="addTask" />
      <u-button type="primary" size="small" text="添加" @click="addTask" />
    </view>

    <view class="toolbar">
      <u-tabs :list="[{name:'全部'},{name:'进行中'},{name:'已完成'}]" :current="0"
              @change="(i:number)=> filter = ['all','active','done'][i]" />
      <scroll-view scroll-x class="tags">
        <view v-for="tag in allTags" :key="tag" class="tag"
              :class="{ on: activeTag === tag }" @click="activeTag = activeTag === tag ? '' : tag">
          #{{ tag }}
        </view>
      </scroll-view>
    </view>

    <view class="list">
      <TaskItem v-for="t in visibleTasks" :key="t._id" :task="t"
                @toggle="toggle(t)" @remove="remove(t)" @edit="openEdit(t)"
                @focus="goFocus(t)" />
      <view v-if="!visibleTasks.length" class="empty">
        <text>暂无任务，先添加一个开始专注吧</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx; background: #f7f8fa; }
.add-bar { display: flex; gap: 16rpx; align-items: center; }
.add-input { flex: 1; background: #fff; border-radius: 16rpx; padding: 18rpx 24rpx; }
.tags { margin-top: 16rpx; white-space: nowrap; }
.tag { display: inline-block; margin-right: 12rpx; padding: 8rpx 20rpx;
       border-radius: 999rpx; background: #eef0f3; color: #666; font-size: 24rpx; }
.tag.on { background: var(--u-primary); color: #fff; }
.empty { text-align: center; color: #999; margin-top: 160rpx; }
</style>
```

`TaskItem.vue`（摘录 `<script setup>` 部分，uView Plus 徽标渲染优先级/标签）：

```vue
<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import type { Task } from '@/types/task'
const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ (e:'toggle'):void; (e:'remove'):void
                           (e:'edit'):void; (e:'focus'):void }>()
const prioText = ['', '低', '中', '高']
</script>
<template>
  <view class="item" @click="emit('edit')">
    <u-checkbox :modelValue="task.completed" @click.stop="emit('toggle')" />
    <view class="main">
      <view :class="['title', task.completed && 'done']">{{ task.title }}</view>
      <view v-if="task.tags.length" class="meta">
        <text v-for="tag in task.tags" :key="tag" class="chip">#{{ tag }}</text>
        <text class="pomo">🍅 {{ task.donePomodoros }}/{{ task.estimatePomodoros || '∞' }}</text>
      </view>
    </view>
    <u-tag v-if="task.priority" :text="prioText[task.priority]" type="warning" size="mini" />
    <view class="ops">
      <text class="op" @click.stop="emit('focus')">▶</text>
      <text class="op" @click.stop="emit('remove')">🗑</text>
    </view>
  </view>
</template>
```

---

## 5. 开发 Roadmap 建议（双端顺序与避坑）

### 5.1 阶段划分

| 阶段 | 内容 | 验收 |
|---|---|---|
| **M0 基建（约 1 周）** | HBuilderX（4.6x+）+ DevEco Studio 5.0.x 环境；项目脚手架（Vue3+TS）；uView Plus 按需引入；CI 准备 | 同一套代码可跑 H5 与安卓真机 |
| **M1 任务管理（本地）**（1–2 周） | task CRUD + 排序/标签/优先级 + `utils/storage` 封装；Pinia | 断网可完整使用 |
| **M2 番茄钟核心**（2 周） | `usePomodoro`（纯逻辑 + 单测时间戳用例）；focus 页 + TimerRing；本地通知；**安卓**：常亮 + uts 前台服务 + 通知栏进度 | 退后台/锁屏 30 分钟计时准确、完成有提醒 |
| **M3 账号与同步**（1 周） | 服务端 Express+Mongo 上架（注册/JWT）；增量同步（LWW/软删）；专注记录上报 | 双设备登同一账号数据一致 |
| **M4 白噪音 + 专注统计**（1–2 周） | 原生后台音频（AudioFocus）+ 白噪音面板；统计页 + 热力图(uCharts)；周/月报表接口 | 锁屏续播；热力图与真实记录一致 |
| **M5 自习室**（1–2 周） | WebSocket RoomHub：房间列表/在线人数/presence/弹幕；弱网重连 | 双端互见状态、断线 10s 内恢复 |
| **M6 鸿蒙接入**（2–3 周，与 M2–M5 并行评估） | 见 5.2 专项；真机（API 14+）全流程：运行→权限→长时任务→发布包 | 鸿蒙真机核心链路可用 |
| **M7 防打扰 + 双端打磨**（1–2 周） | 权限引导页（悬浮窗/使用情况/电池白名单/通知）；鸿蒙能力降级文案；多分辨率适配（rpx + 安全区） | 各权限入口可检测可回跳 |
| **M8 合规与上架**（1–2 周） | 隐私政策、FGS specialUse 用途声明、鸿蒙长时任务场景说明、签名证书、AGC/应用市场材料 | 双端过审 |

> **关键顺序决策**：M2–M5 全部在**安卓先行**（迭代快、云打包方便、真机多）；鸿蒙 M6 放在功能稳定后**一次性接入**，避免双端联调互相阻塞。若最终要原生级双端体验，可评估在 **uni-app x** 上重写（语法接近 Vue3/TS，见 0.2），建议最迟在 M6 前做出决策。

### 5.2 鸿蒙专项 checklist（易踩坑）

1. **条件编译语义**：鸿蒙不命中 `APP-PLUS`——所有"安卓+iOS 专属且鸿蒙需同样逻辑"的代码改判 `APP`；鸿蒙独有逻辑用 `APP-HARMONY`；排查存量 `#ifdef APP-PLUS` 使用点（风险 R1）；
2. **环境**：本地安装 DevEco Studio；Windows 工程路径尽量短（< 255 字符，鸿蒙编译器会给产物加 hash，路径过长直接编译失败，uni_modules 目录名也要短）；
3. **证书**：真机需调试证书（绑定设备），改权限需重新出证书；发布走 AGC 签名，证书配置在 `harmony-configs` 与 `build-profile.json5`；
4. **权限**：一律手工写在 `module.json5`；`KEEP_BACKGROUND_RUNNING` 需 reason + usedScene；ACL 受限权限（如悬浮窗）需 AGC 申请，本产品鸿蒙端**不做**悬浮窗监测；
5. **长时任务**：白噪音在播 → 申请 `AUDIO_PLAYBACK` 并通知常驻；纯静音倒计时后台不保证 → 时间戳校准 + 结束本地通知兜底（M2 核心已内置）；上架需场景说明；
6. **调试效率**：早期鸿蒙无热刷新、无云打包，每次改代码要本地重编签名安装 → 安排独立真机 + 小步联调，勿把鸿蒙接入压到发布前一周。

### 5.3 双端共性风险清单

| 编号 | 风险 | 缓解 |
|---|---|---|
| R1 | 条件编译 `APP-PLUS` 不再含鸿蒙 | 适配层统一出口 + 全局 grep 检查；定义 `APP` 覆盖三端 |
| R2 | JS 计时后台被冻结/被杀 | 时间戳驱动（4.1）+ 原生保活 + 恢复校准 |
| R3 | Android 13+ 通知、Android 12+ 精确闹钟需运行时/设置授权 | permission-guide 引导页 + 状态检测 |
| R4 | 安卓厂商省电策略杀后台 | 前台服务 + 引导"忽略电池优化" + 通知常驻（用户可感知） |
| R5 | 鸿蒙组件/API 兼容性（uView Plus 等三方库在鸿蒙真机验证） | 提前在 M6 第一周跑通"页面骨架 + 核心组件"清单；异常组件降级 uni-ui 或自写 |
| R6 | 鸿蒙上架合规（长时任务/隐私） | M8 预留充足审核时间；素材文案提前准备 |
| R7 | 分辨率/折叠屏/安全区差异 | rpx 布局 + `safe-area-inset-*` + 关键页（专注页）双端真机走查 |

### 5.4 建议的验收测试矩阵

| 用例 | 安卓 | 鸿蒙 |
|---|---|---|
| 专注 25min 完整跑完 → 休息提醒 | ✅ 锁屏/退后台各 1 次 | ✅ 挂起/锁屏各 1 次 |
| 中途暂停 5min 再恢复 | ✅ | ✅ |
| 白噪音锁屏 30min 续播 | ✅ 来电抢占后恢复 | ✅ 闹钟/来电打断后恢复 |
| 通知栏进度条准确性 | ✅ 与页面一致 | ✅ 与页面一致 |
| 离线新增 10 任务 → 联网同步 | ✅ | ✅ |
| 自习室状态互见 + 断线重连 | ✅ | ✅ |
| 防打扰检测命中娱乐 App 提示 | ✅（真机+辅助功能授权） | ➖（降级项，文案展示） |

---

## 附：交付物对照

| 需求文档交付物 | 本方案位置 |
|---|---|
| ① 项目目录结构设计 | 第 2 章 |
| ② 数据库设计（用户/任务/专注记录 Schema） | 第 3 章（另含自习室与同步策略） |
| ③a 番茄钟核心代码（状态处理 + 持久化） | 4.1 `usePomodoro.ts` |
| ③b manifest.json 双端权限配置 | 4.2（安卓）+ 4.3（鸿蒙 module.json5） |
| ③c 任务列表页 `.vue` 组件 | 4.6 `pages/task/index.vue` |
| ④ 双端打包 roadmap（鸿蒙 API 兼容性等） | 第 5 章 |
| 约束：Vue3 `<script setup>` | 4.6 及 4.1 均使用 |
| 约束：`#ifdef APP-PLUS` 条件编译示例 | 4.4 `platform/*` 适配层 |
