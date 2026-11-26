// server/src/http.ts — 本地开发后端入口（Bun）。
//
// 监听 8787（可用环境变量 MCS_PORT 覆盖）：
//   GET  /health          → { ok, service, mode: 'local', port, db, profiles }
//   POST /actions         → { action, input } → { result } 或 { error }
//                          与 client/src/api.ts 的 fetch 形状完全一致
//   GET  /assets/<id>/…  → server/data/assets/ 下的素材文件
//   GET  /assets/runtime/base.webp → client/src/assets/runtime/base.webp（若已放置）
//
// 数据持久化：SQLite 文件 server/data/studio.db（gitignored，不提交）。
// 启动即建表；种子数据不自动写入，首次打开前端时 App 会调 seedStudio，
// 也可以直接 curl POST /actions seedStudio。
//
// 这是开发用的本地服务，不要把它暴露到公网；线上工作室的服务端
// 仍在 Muse artifact 运行时里，两者数据不互通。

import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { initDb, openDb } from './schema'
import { dispatchAction, type ActionContext } from './actions'

export const PROJECT_ROOT = resolve(import.meta.dir, '../..')
export const DATA_DIR = join(PROJECT_ROOT, 'server/data')
export const DB_PATH = join(DATA_DIR, 'studio.db')
export const ASSETS_DIR = join(DATA_DIR, 'assets')
export const PORT = Number(process.env.MCS_PORT ?? 8787)

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

export function createContext(): ActionContext {
  mkdirSync(ASSETS_DIR, { recursive: true })
  const db: Database = openDb(DB_PATH)
  initDb(db)
  return { db, projectRoot: PROJECT_ROOT, assetsDir: ASSETS_DIR }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export function createServer(ctx: ActionContext) {
  return Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)

      if (req.method === 'GET' && url.pathname === '/health') {
        const count = (ctx.db.query('SELECT COUNT(*) AS n FROM character_profiles').get() as { n: number }).n
        return jsonResponse({
          ok: true,
          service: 'muse-character-studio-server',
          mode: 'local',
          port: PORT,
          db: DB_PATH,
          profiles: count,
          warning:
            '本地后端：generateAsset / clearAvatar / getRuntimeAssets 依托 Muse，本地会明确报错或返回 warning，绝不伪造（见 server/BACKEND.md）。',
        })
      }

      if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const rest = decodeURIComponent(url.pathname.slice('/assets/'.length))
        // 运行时原图：client/src/assets/runtime/base.webp（若用户已放置）。
        if (rest === 'runtime/base.webp') {
          const runtimeBase = join(PROJECT_ROOT, 'client/src/assets/runtime/base.webp')
          if (existsSync(runtimeBase)) return new Response(Bun.file(runtimeBase))
          return jsonResponse({ error: '本地没有 base.webp：client/src/assets/runtime/ 下只有说明，没有这张大图；见 server/BACKEND.md 的 importRuntimeBase 说明' }, 404)
        }
        const filePath = resolve(ASSETS_DIR, rest)
        if (!filePath.startsWith(ASSETS_DIR) || !existsSync(filePath)) {
          return jsonResponse({ error: `素材不存在：${rest}` }, 404)
        }
        const file = Bun.file(filePath)
        return new Response(file, {
          headers: { 'Content-Type': CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream' },
        })
      }

      if (req.method === 'POST' && url.pathname === '/actions') {
        let body: unknown
        try {
          body = await req.json()
        } catch {
          return jsonResponse({ error: '请求体不是合法 JSON' }, 400)
        }
        const { action, input } = body as { action?: unknown; input?: unknown }
        if (typeof action !== 'string' || action === '') {
          return jsonResponse({ error: '缺少 action（需要 { action, input }）' }, 400)
        }
        try {
          const result = await dispatchAction(ctx, action, input ?? {})
          return jsonResponse({ result })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          return jsonResponse({ error: message })
        }
      }

      return jsonResponse({ error: `未知路由：${req.method} ${url.pathname}` }, 404)
    },
  })
}

// 直接运行时（bun run server/src/http.ts）才起服务；被 import 时只导出函数。
if (import.meta.main) {
  const ctx = createContext()
  const server = createServer(ctx)
  console.log(`[muse-character-studio] 本地后端已启动 http://localhost:${server.port}`)
  console.log(`[muse-character-studio] 数据库 ${DB_PATH}`)
  console.log(`[muse-character-studio] 素材目录 ${ASSETS_DIR}`)
  console.log('[muse-character-studio] 健康检查 GET /health；动作 POST /actions { action, input }')
}
