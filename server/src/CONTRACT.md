# server/src — 后端契约（本轮不动）

本轮只重写前端。后端业务模型、Drizzle 迁移、server/src/actions.ts 与
schema.ts 均不动，复用已有 30 个动作的请求/响应契约与 Zod 校验。

关键契约（见 client/src/api.ts）：
- getStudio / getProfileDetail / saveSettings / generateAsset /
  adoptCandidate / activateProfile / uploadAsset / importRuntimeBase
- activateProfile 只写本地 activations（providerStatus='local_record'），
  不调用 Muse avatar.set、不改运行时头像、不改长期记忆。
- shared_base：independentStateAssets=false，candidateIdReusable=false，
  仅 base 槽位 configurable，10 条 state_definitions，完成度分母只计
  configurable 槽位（x/1）。

如需改后端，请另开任务，不要在本轮顺手改。
