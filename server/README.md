# 番茄Todo 后端（Node.js + Express + MongoDB + WebSocket）

## 快速开始

```bash
npm install
cp .env.example .env      # 按需修改 MONGODB_URI / JWT_SECRET
npm run dev               # tsx watch，默认 http://127.0.0.1:3000
```

需要本机可用的 MongoDB（默认 `mongodb://127.0.0.1:27017/tomato`，可用 Docker 或本地安装）。

## 结构

```
src/
├── app.ts               # Express 装配（CORS / JSON / 路由 / 统一错误）
├── index.ts             # 入口：连库 + 启动 http/ws
├── config/              # env / db
├── middleware/auth.ts   # JWT 鉴权（optional 模式允许匿名）
├── models/              # user / task / focusRecord / room / roomMessage
├── routes/              # auth / task / focus / stats / room
├── services/            # stats 聚合、dateKey（时区日键）
└── ws/                  # WebSocket 升级 + RoomHub（自习室 presence/弹幕广播）
```

## 接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/v1/auth/register · /login | 注册 / 登录（JWT） |
| GET | /api/v1/auth/me | 当前用户 |
| GET | /api/v1/tasks?since= | 增量拉取任务 |
| POST | /api/v1/tasks | 按 clientId 幂等创建（离线去重） |
| PUT / DELETE | /api/v1/tasks/:id | 更新 / 软删除 |
| POST | /api/v1/focus-records | 上报专注记录 |
| GET | /api/v1/focus-records | 分页查询 |
| GET | /api/v1/stats/heatmap?from=&to= | 专注热力图 |
| GET | /api/v1/stats/report?range=week\|month | 周/月报表 |
| GET / POST | /api/v1/rooms | 房间列表（含在线人数）/ 创建 |
| WS | /ws/room/:roomId?token= | 自习室实时通道 |

## 与前端联调

- H5：直接访问 `http://127.0.0.1:3000`（CORS 已放开）；
- 真机：把 `src/api/http.ts` 的 `VITE_API_BASE`（或 `.env`）指向电脑局域网 IP；
- 自习室 WS 地址由 `src/api/http.ts` 的 BASE 推导（http→ws）。
