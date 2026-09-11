/**
 * 一键托管开发用 MongoDB（无需安装 MongoDB）。
 *
 * - 用 mongodb-memory-server 自动下载 mongod 并启动（首次运行会下载约 100MB，
 *   默认走 npmmirror 国内镜像，可用环境变量 MONGOMS_DOWNLOAD_MIRROR 覆盖）。
 * - dbPath 固定在 server/data/mongo，数据落盘持久化，重启不丢。
 * - 端口固定 27017，与后端默认连接串 mongodb://127.0.0.1:27017/tomato 匹配，
 *   后端无需任何额外配置。
 * - 如果 27017 已被占用（比如本机装了真 MongoDB），直接退出让后端连现成的。
 */
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../data/mongo')
const PORT = 27017

// 国内镜像加速下载（用户自己的环境变量优先）
process.env.MONGOMS_DOWNLOAD_MIRROR ||= 'https://registry.npmmirror.com/-/binary/mongodb'

function portOpen(port) {
  return new Promise(resolve => {
    const s = net.connect({ port, host: '127.0.0.1', timeout: 800 })
    s.on('connect', () => { s.destroy(); resolve(true) })
    s.on('error', () => resolve(false))
    s.on('timeout', () => { s.destroy(); resolve(false) })
  })
}

const inUse = await portOpen(PORT)
if (inUse) {
  console.log(`[mongo] 端口 ${PORT} 已被占用——本机已有 MongoDB 在运行，无需重复启动。`)
  console.log('[mongo] 后端可直接连接 mongodb://127.0.0.1:27017/tomato')
  process.exit(0)
}

fs.mkdirSync(DB_PATH, { recursive: true })

console.log('[mongo] 正在启动 MongoDB（首次运行会自动下载 mongod，约 100MB，请耐心等待）…')
const { MongoMemoryServer } = await import('mongodb-memory-server')
const mongod = await MongoMemoryServer.create({
  instance: { port: PORT, dbPath: DB_PATH, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
})

console.log(`[mongo] MongoDB 已就绪：${mongod.getUri()}`)
console.log('[mongo] 数据目录：' + DB_PATH)
console.log('[mongo] 保持本窗口开着即可；关闭窗口 = 停止 MongoDB（数据已落盘，不会丢）。')

// 让进程常驻（内存服务随进程退出而停止）
setInterval(() => {}, 1 << 30)
