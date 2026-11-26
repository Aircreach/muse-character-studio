// server/dev-full.ts — 同时起后端（8787）与前端开发服务器（5173）。
//
// 用法：bun run dev:full
// 两个进程都以前台方式输出日志；任一进程退出即结束另一个。
// 只想起前端（不带后端，角色库会加载失败，见 README“后端”一节）用 bun run dev。

import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

const backend = Bun.spawn(['bun', 'run', 'server/src/http.ts'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
})
const frontend = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
})

console.log('[dev:full] 后端 http://localhost:8787 · 前端 http://localhost:5173')

const stop = (code: number) => {
  try {
    backend.kill()
  } catch {
    // 已退出
  }
  try {
    frontend.kill()
  } catch {
    // 已退出
  }
  process.exit(code)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

const first = await Promise.race([
  backend.exited.then(() => 'backend'),
  frontend.exited.then(() => 'frontend'),
])
console.log(`[dev:full] ${first} 已退出，正在停止另一个进程…`)
stop(0)
