import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // 本地后端（bun run dev:server，端口 8787）：
    // 前端 POST ./actions 与 /assets/ 预览都代理到它。
    // 只起前端（bun run dev）时没有这个代理，角色库会加载失败——
    // 这是预期的：数据在服务端。完整启动用 bun run dev:full。
    proxy: {
      '/actions': 'http://localhost:8787',
      '/assets': 'http://localhost:8787',
    },
  },
})
