# server/src — 后端（本地真后端，2026-11-26 还原）

线上 Muse Character Studio 的后端已完整还原到本地，不再是只有契约说明。

- `schema.ts` — 数据模型与 SQLite 层（建表、行记录 ↔ 领域类型映射、settingsText 拼接）
- `actions.ts` — 线上 30 个真实动作 + 9 个本地兼容别名（见 BACKEND.md）
- `seed.ts` — A/B 两张种子卡与 10 条状态定义，按线上实测原样
- `muse.ts` — 依托 Muse 的功能集中处理：明确报错 / 返回 warning，绝不伪造
- `http.ts` — Bun 服务入口（8787，`POST /actions`、`GET /health`、`GET /assets/`）

详细说明、动作清单、与线上的差异、Muse 依赖警告表、启动与重置方法：
见 `server/BACKEND.md`。

关键契约（与线上一致）：
- getStudio / getProfileDetail / saveSettings / generateAsset /
  adoptCandidate / activateProfile / uploadAsset / importRuntimeBase
- activateProfile 只写本地 activations（providerStatus='local_record'），
  不调用 Muse avatar.set、不改运行时头像、不改长期记忆。
- shared_base：independentStateAssets=false，candidateIdReusable=false，
  仅 base 槽位 configurable，10 条 state_definitions，完成度分母只计
  configurable 槽位（x/1）。
- saveSettings 32 字段各 ≤4000 字 + customFields ≤40 项，全量覆盖；
  generateAsset 入参 stateBrief ≤1000、extra ≤1000，产物 status=candidate，
  须 adoptCandidate 才进画廊；uploadAsset 仅 png/jpeg/webp/gif/mp4/webm，算 SHA-256。

本地与线上数据不互通：线上是一套，本地 SQLite 是另一套，种子 id 相同
但内容各自独立，改本地不会动线上。
