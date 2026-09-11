import { createApp } from './app'
import { connectDb } from './config/db'
import { PORT } from './config/env'
import { attachWs } from './ws'

async function main(): Promise<void> {
  await connectDb()
  const app = createApp()
  const server = app.listen(PORT, () => {
    console.log(`[server] http + ws ready on http://127.0.0.1:${PORT}`)
  })
  attachWs(server)
}

main().catch(e => {
  console.error('[server] 启动失败:', e)
  process.exit(1)
})
