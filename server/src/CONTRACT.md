# server/src — 后端架构与契约总览

本地真后端（Bun + SQLite WAL），完整还原线上 30 个真实动作与 9 个本地兼容别名，并将 Muse 运行时交互隔离至独立适配器模块。

## 模块分层（高内聚、低耦合）

- `adapters/muse/provider.ts` — `MuseRuntimeProvider` 抽象接口、`MuseDependentError` 与常量契约
- `adapters/muse/local-provider.ts` — `LocalMuseProvider` 本地实现（唯一能力矩阵来源 `LOCAL_AUDITED_CAPABILITIES`、`server/data/runtime-media/` 真实读取、无伪造 `[MUSE_DEPENDENT]` 守卫）
- `adapters/muse/index.ts` — 适配器统一导出入口
- `muse.ts` — 兼容转发层（保持旧 import 路径不断）
- `schema.ts` — 9 张 SQLite 表与领域类型映射、`settingsText` 拼接
- `seed.ts` — A/B 两张种子卡与 10 条内置状态定义
- `actions.ts` — 核心业务编排（30 个 `REAL_ACTIONS` + 9 个 `[LOCAL ALIAS]`），通过 `ActionContext.muse` 依赖抽象接口，不直接耦合具体 Muse 实现
- `http.ts` — 组合根与 HTTP 服务入口（8787，`POST /actions`、`GET /health`、`GET /assets/`），在 `createContext()` 中注入 `LocalMuseProvider`

## 关键契约（与 Muse 确认一致）

- `getCapabilities()` 是能力矩阵唯一事实来源（`shared_base`，`independentStateAssets=false`，`candidateIdReusable=false`）。
- `activateProfile` 为核心本地业务：仅写入本地 `activations`（`providerStatus='local_record'`）与 `active_profile`，绝不隐式调用 `avatar.set` 或改写长期记忆；与 Muse 同步只能作为显式、独立的第二步。
- 候选与正式素材严格隔离：`status='candidate'` 产物须经 `adoptCandidate` 才进画廊，`discardCandidate` 删除文件。
- 9 张表、30 个线上真实动作与 9 个本地别名契约保持完全向后兼容，详见 `server/BACKEND.md`。
