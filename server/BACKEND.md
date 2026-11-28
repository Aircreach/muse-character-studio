# Muse Character Studio — 本地后端说明（BACKEND.md）

2026-11-26 还原。线上 artifact（slug `muse-character-studio`）未动；
这里是按线上实测重建的本地后端，跑在 Bun + SQLite 上。

## 一、线上 30 个真实动作（以 artifact.list_actions 为准）

动作名按线上发布的原样，请求 schema 逐个取自线上（2026-11-26）：

| 动作 | 入参（要点） | 说明 |
| --- | --- | --- |
| getStudio | `{}` | 全部角色卡、activeProfileId、能力矩阵 |
| getProfileDetail | `{ id }` | 单卡全量：设定、整合文本、画廊、素材、候选、参考、任务、激活历史 |
| getCapabilities | `{}` | 已审计能力矩阵（shared_base，见下） |
| seedStudio | `{}` | 首开种入 A/B 两张卡；已有任意卡时 no-op，返回 `seeded:false` |
| createProfile | `{ name≤80, subtitle≤120, description≤2000, tags≤12 }` | 同名允许，带空设定 |
| updateProfile | `{ id, name≤80, subtitle?, description?, tags? }` | 未传字段保留原值（见“三、差异”） |
| duplicateProfile | `{ id }` | 复制设定、画廊链接与参考；素材共享不复制文件 |
| archiveProfile | `{ id }` | 激活中禁止归档 |
| restoreProfile | `{ id }` | 取消归档 |
| deleteProfile | `{ id }` | 激活中禁止；删设定、画廊、素材（含文件）、任务、激活记录 |
| toggleFavorite | `{ id }` | 收藏取反 |
| saveSettings | `{ profileId, settings }` 全量 33 字段（各 ≤4000）+ customFields ≤40 | 全量覆盖，返回整合文本；本地前端发 `{ profileId, patch }`，后端也接受并合并 |
| uploadAsset | `{ profileId, dataBase64≤28MB, mimeType, note≤500?, select?, source?, stateKey? }` | 仅 png/jpeg/webp/gif/mp4/webm；算 SHA-256；存 `server/data/assets/` |
| selectStateAsset | `{ profileId, stateKey, assetId }` | 选定某槽位的素材（每槽唯一）；未链入时自动链入 |
| linkAssetToState | `{ profileId, stateKey, assetId }` | 链入素材不改变选中 |
| unlinkStateAsset | `{ linkId }` | 移除链接，素材本身留在库里 |
| deleteAsset | `{ assetId, profileId? }` | 被选中时禁止；删文件与全部链接 |
| setCover | `{ profileId, assetId \| null }` | 封面仅展示用，不是 Muse 头像 |
| setReference | `{ profileId, assetId, kind: appearance \| style }` | 标记外观/画风参考 |
| removeReference | `{ id }` | 移除参考标记（id 是参考记录 id） |
| generateAsset | `{ profileId, stateKey, stateBrief≤1000, extra≤1000 }` | ⚠️ 依托 Muse，本地明确报错（见二） |
| adoptCandidate | `{ profileId, assetId, stateKey, select=true }` | 候选转正并链入画廊 |
| discardCandidate | `{ assetId }` | 丢弃候选并删文件 |
| activateProfile | `{ profileId, note≤500? }` | 校验未归档且 base 有选中素材；写本地激活记录 + 快照，不调 avatar.set |
| deactivateProfile | `{}` | 清除当前激活 |
| exportProfile | `{ profileId }` | 返回 `{ json }`，格式 `muse-character-studio/profile@1`，不嵌素材字节 |
| importProfile | `{ json }` | 只恢复 profile + settings，不恢复素材文件；id 冲突时换新 id |
| addStateDefinition | `{ stateKey ^[a-z0-9_]+$≤40, name≤40, description≤500? }` | stateKey 唯一；新定义不可配置、非必填 |
| updateStateDefinition | `{ id, name, description, required, sortOrder 0–999 }` | 改名/描述/必填/排序 |
| deleteStateDefinition | `{ id }` | base 不可删；内置 10 条不可删，只能删后加的自定义定义 |

返回形状（实测）：
- `getProfileDetail`：`{ profile, settings, settingsText, stateDefs, slots, assets, candidates, references, jobs, activations, isActive }`；slots 每卡 10 个，初始 assets 为空、selectedAssetId 为 null。
- `exportProfile`：`{ json }`，json 内含 format、exportedAt、profile、settings、settingsText、stateDefinitions、gallery、assets、note（“素材文件字节未包含在此导出中”）。
- `activateProfile` 返回 `{ activation, activeProfileId }`，activation.snapshotJson 含 `mode/baseAssetId/baseAssetSha256/stateSelections/settingsText`，providerStatus 为 `local_record`。
- `getCapabilities` 返回的能力矩阵见 `server/src/actions.ts` 的 `CAPABILITIES` 常量，与线上实测逐字一致（含 darkModeVariants、notes、runtimeAvatar、runtimeStates）。

## 二、Muse 依赖功能警告表

本地没有 Muse 的 generate_media、运行时头像、候选流程。下面这些功能
在本地是**明确报错或返回 warning，绝不伪造**：

| 功能 | 本地表现 | 为什么 | 替代做法 |
| --- | --- | --- | --- |
| 生成图片 generateAsset | 报错 `[MUSE_DEPENDENT]`，不产生假图；失败会记一条 status=error 的任务，可在生成中心看到 | 需要 Muse 的 generate_media，本地调不到 | 在线上工作室生成候选；或用 uploadAsset 上传真实图片 |
| 读取 Muse 运行时形象 getRuntimeAssets | `server/data/runtime-media/` 有真实媒体时返回真实清单 `{ baseImageUrl, baseSha256, stateFrames, items[] }`（每项 `{ stateKey, kind: 'video'\|'image', url, posterUrl, darkUrl, label }`）；没有时返回 `{ baseImageUrl: null, baseSha256: null, stateFrames: {}, items: [], warning }`，不编造运行时帧 | 本地够不到 Muse 运行时；仓库自带完整示例（19 个文件，见下节），克隆后直接可用 | 看线上工作室 getCapabilities 的 runtimeAvatar（MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`）；或把 `~/workspace/avatars/` 里的真实视频/帧按命名约定复制到 `server/data/runtime-media/` |
| 清除 Muse 头像 clearAvatar | 报错 `[MUSE_DEPENDENT]`，本地资产不受影响 | 需要访问 Muse 运行时头像 | 在 Muse 本人处清除头像 |
| 一键导入运行时原图 importRuntimeBase | 本地没有 base.webp 时报错 `[MUSE_DEPENDENT]`，并提示已知副本位置 | 仓库自带一份示例 base.webp（`client/src/assets/runtime/base.webp`），开箱即用 | 把原图复制到 `server/data/runtime-base.webp` 后重试（备用）；或在线上工作室用系统页导入。已验证：放图后导入成功，1600×1600、SHA-256 与原文件一致，第二次调用返回同一素材（alreadyPresent） |

其他说明：
- `setCover` 只是展示用封面，不是 Muse 头像；`activateProfile` 只写本地记录。
- 本地后端不生成缩略图（线上会生成）：上传素材的 `thumbnailPath` 为 null，
  前端用原图 URL 预览。
- 图片宽高：PNG/GIF/WebP 尽量解析，解析不到时为 null，不阻塞上传。

### 运行时媒体目录 `server/data/runtime-media/`（getRuntimeAssets 的真实来源，已进仓库）

仓库自带完整示例角色数据（2026-11-28，用户决定：给一份完整的角色数据）：
19 个文件，约 12 MB，克隆后 `getRuntimeAssets` 开箱即用。

命名约定（`state` 取自状态定义，另加 `base`；`-dark` 为深色版）：

| 文件 | 含义 |
| --- | --- |
| `<state>.mp4` / `<state>.webm` | 浅色视频；有视频时该状态 `kind='video'`，画廊播视频 |
| `<state>-dark.mp4` / `<state>-dark.webm` | 深色视频；深色界面时播，没有就回退浅色版 |
| `<state>.webp` / `.png` / `.jpg` / `.gif` | 浅色静态帧；兼视频 `poster` |
| `<state>-dark.webp` … | 深色静态帧 |
| `base.webp` | 基础形象原图（v1，MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`）；兼各视频无帧时的 `poster` |
| `base-dark.webp` | 深色基础图 |

当前头像的真实文件已从 `~/workspace/avatars/` 复制到该目录：7 个状态的 MP4
（connecting、idle、making_something、milestone_level_up、waiting_for_subagents、
waking、working；connecting/idle 共用一个文件，working/waiting_for_subagents 共用一个文件）、
5 张静态帧（idle、making_something、milestone_level_up、waking、working）、深色版视频 5 个、
深色基础图 1 张。listening / thinking / speaking / error 不是 Muse 独立槽位，本来就没有画面。
目录不存在或没有可识别文件时，`getRuntimeAssets` 返回空 + warning；画廊对应卡片显示
“暂无运行时画面”占位，不会用基础图冒充各状态帧。经 `GET /assets/runtime-media/…` 取文件。

### 线上部署时 `getRuntimeAssets` 的适配（重要）

`getRuntimeAssets` 是本地别名，线上不发布该动作。本地前端（`Workspace.tsx`）
调它取真实运行时媒体；调用失败或返回空时，画廊运行时状态显示明确占位。
所以**部署到线上时，构建器必须在适配层（`studio.ts`）实现 `getRuntimeAssets`，
返回内置媒体的同形清单**（内置的五张真实静态帧、以及能内置的 MP4 视频，
`url` 指向 artifact 内置文件），否则线上画廊运行时状态会显示“暂无运行时画面”，
而不是旧版的五张内置帧。不要为了填满而用基础图冒充各状态帧。

## 三、本地 api.ts 与线上的差异

旧版 `client/src/api.ts` 列的 30 个动作与线上不一致，还原时已按线上修正，
差异点：

1. 旧 api.ts 多出 9 个动作，线上不发布，现为本地兼容别名（`api.ts` 里标
   `[LOCAL ALIAS]`，后端 `actions.ts` 末尾 `LOCAL_ALIASES`）：
   - `selectAsset` → `selectStateAsset`
   - `deleteCandidate` → `discardCandidate`（入参 candidateId）
   - `getSettingsText` / `listActivations` / `listGenerationJobs`：由
     getProfileDetail 派生的只读查询
   - `importRuntimeBase`：本地原图导入（线上对应流程是 uploadAsset source='imported'）
   - `getRuntimeAssets` / `clearAvatar`：见上表
   - `verifyAssetIntegrity`：本地校验素材文件存在与 SHA-256
2. 旧 api.ts 少了 8 个线上真实动作，现已补上：
   addStateDefinition、updateStateDefinition、deleteStateDefinition、
   linkAssetToState、unlinkStateAsset、setCover、setReference、removeReference。
3. 形状修正（按线上 schema）：
   - `saveSettings`：线上是 `{ profileId, settings }` 全量；本地前端发
     `{ profileId, patch }`，后端两种都接受（patch 合并保存）。
   - `uploadAsset`：线上是 `{ dataBase64, mimeType }`；本地前端发
     `{ file: File }`，`api.ts` 的 fetch 封装在发请求前把 File 转成
     base64（线上平台原生做这件事，本地 Vite 发不出 File，所以这里补
     了一个传输层转换，不改业务逻辑）。
   - `adoptCandidate` / `discardCandidate`：线上用 `assetId`，本地前端用
     `candidateId`；后端两个都接受（候选 id 即素材 id）。
   - `exportProfile`：线上返回 `{ json }`（单个 JSON 字符串）；旧 api.ts
     写的是 `{ profileJson, settingsJson }`，已修正。`importProfile` 线上
     入参是 `{ json }`，旧形状 `{ profileJson, settingsJson }` 仍接受。
   - `deleteAsset`：线上入参只有 `{ assetId }`；本地前端多传 profileId，
     后端接受并用于共享素材的归属校验。
   - `StateDefinition`：线上返回含 `id`，旧 `shared.ts` 类型里没有，已补上。
4. 行为上为保安全做的两处与线上 schema 字面含义不同的选择：
   - `updateProfile`：未传的 subtitle/description/tags 保留原值，不按
     zod 默认清空（避免一次改名误删其他字段）。
   - `deleteStateDefinition`：只允许删后加的自定义定义，内置 10 条不让删
     （线上描述是“删除自定义状态定义”）。
   - `deleteAsset` / `selectStateAsset` 等：复制卡共享的素材（素材行属于
     原卡）也算可用——拥有或已链入本卡画廊的素材都能选、设封面、做参考；
     删共享素材会删文件与全部链接。
   - `settingsText`：按线上实测格式拼接（种子数据下与线上逐字一致，
     已实测比对）。线上对种子里为空的 16 个字段（background、worldSetting、
     values、strengths、weaknesses、emotionalTraits、quirks、vocabulary、
     addressStyle、catchphrases、accessories、bodyFeatures、
     generationPrompt、negativePrompt、compositionPreferences、
     imageConstraints）非空时是否列出，无法在不改线上数据的前提下验证；
     本地按分组补列（图片生成设定单列一组），见 `schema.ts` 注释。

## 四、文件与数据

```
server/
├── tsconfig.server.json   # 服务端 tsc 配置（types: bun-types）
├── dev-full.ts            # bun run dev:full：同时起后端 8787 + 前端 5173
├── BACKEND.md             # 本文件
└── src/
    ├── schema.ts          # 模型 + SQLite 建表 + 映射 + settingsText
    ├── seed.ts            # 种子数据（A/B 卡、10 条状态定义，id 与文案按线上实测）
    ├── muse.ts            # Muse 依赖功能的报错 / warning 集中处
    ├── actions.ts         # 30 个真实动作 + 9 个本地别名 + 分发表
    ├── http.ts            # Bun 服务：8787，POST /actions，GET /health，GET /assets/
    └── CONTRACT.md        # 契约总览
```

数据文件（`studio.db*`、`assets/`、`runtime-base.webp` 在 `.gitignore` 里，不提交；
`runtime-media/` 是已进仓库的完整示例角色数据，见上节）：
- `server/data/studio.db` — SQLite，唯一权威元数据
- `server/data/studio.db-wal` / `-shm` — SQLite WAL 临时文件
- `server/data/assets/<profileId>/<assetId>.<ext>` — 素材文件
- `server/data/runtime-base.webp` — 可选：手动放置的运行时原图（供
  importRuntimeBase 用，不提交）
- `server/data/runtime-media/` — 已进仓库的完整示例角色数据（19 个文件，约 12 MB，
  视频/静态帧/深色版，供 getRuntimeAssets 用；命名见上节）

表：character_profiles、character_settings、state_definitions、
state_links（槽位链接）、assets、generation_jobs、activations、
active_profile、asset_references。

## 五、启动

```bash
cd ~/workspace/projects/muse-character-studio
bun install
bun run dev:full    # 前端 http://localhost:5173 + 后端 http://localhost:8787
# 只起后端：bun run dev:server
# 只起前端：bun run dev（没有后端，角色库会加载失败）
```

健康检查：`curl http://localhost:8787/health`

```bash
curl -s -X POST http://localhost:8787/actions \
  -H 'Content-Type: application/json' \
  -d '{"action":"getStudio","input":{}}'
```

首次打开前端时 App 会自动调 `seedStudio`（空库时种入 A/B 两张卡）；
也可以直接 curl 调 `seedStudio`。

Vite 代理（`vite.config.ts`）：开发模式下 `./actions` 与 `/assets/`
代理到 `http://localhost:8787`。

## 六、重置数据

删掉 `server/data/` 整个目录（数据库 + 素材文件），下次启动即回到
首开状态（空库，前端自动种入 A/B 卡）：

```bash
rm -rf server/data
```

注意：删掉后本地上传的素材、新建的卡、激活记录都会消失；线上工作室
的数据不受影响（两者不互通）。

## 七、自查结果（实跑，2026-11-26）

- `bun install`：通过（含新增的 `bun-types`）。
- `bun run typecheck`（前端 tsc + 服务端 tsconfig.server.json）：exit 0。
- `bun run build`（tsc 前端+服务端 + vite build）：exit 0，141 模块，
  CSS 26.16 kB，JS 335.57 kB。
- 后端动作检查（curl，脚本 `/tmp/mcs-test.py`，45 项）：全过。
  覆盖：seedStudio、getStudio 2 张卡、getProfileDetail A/B 设定逐项比对、
  settingsText 与线上逐字一致、saveSettings patch 与全量两种形状读写、
  activateProfile 无 base 素材时被拒、uploadAsset 1×1 PNG 的 SHA-256
  与宽高正确且文件可经 /assets/ 取回、selectStateAsset 后激活成功且快照
  含 mode/baseAssetId/baseAssetSha256、归档/删除/删素材在激活与选中时被
  阻止、generateAsset 返回 `[MUSE_DEPENDENT]` 且不产生候选（失败记一条
  error 任务）、getRuntimeAssets 在 `server/data/runtime-media/` 为空时返回 warning 空结果、
  有真实媒体时返回真实清单、clearAvatar 报错、
  exportProfile 格式 `muse-character-studio/profile@1`、importProfile
  往返、add/deleteStateDefinition 与 base 不可删、seedStudio 二次 no-op。
- 补测（`/tmp/mcs-test2.py`，17 项）：16 项通过，1 项是测试期望本身写错
  （复制卡继承 favorite=true，切换后应为 false），已单独复核 B 卡
  false→true→false 确认实现正确。覆盖：importRuntimeBase 无文件时报错
  含已知副本提示、duplicateProfile 共享素材与选中、setCover、
  setReference/removeReference、link/unlinkStateAsset、toggleFavorite、
  updateProfile 保留未传字段、create/deleteProfile、selectAsset 别名。
  补测中发现并修复了一个真 bug：复制卡的 `assets` 列表曾为空（素材行
  属于原卡），已改为拥有或已链入都算可用。
- importRuntimeBase 成功路径：把 `~/workspace/reverse-test/v1-exact.webp`
  复制到 `server/data/runtime-base.webp` 后导入成功，1600×1600、
  164690 字节、SHA-256 与原文件一致，第二次调用返回同一素材
  （alreadyPresent）；测试用副本已删除。
- 前端全链路：`bun run dev:full` 下 `http://localhost:5173/` 返回 200，
  经 Vite 代理 POST /actions 调 getStudio 正常；`api.ts` 的 File→base64
  转换单测通过（dataBase64 与原文件一致、mimeType 正确、file 字段已移除）。
- 测试用的数据库与素材已清空（`rm -rf server/data`），交付时是干净的首开状态。

未验证 / 未做：
- 浏览器里人工点按前端全流程（上传、生成、激活、导入）未做——后端接口
  均已实测，前端在浏览器里的点按仍待用户验收。
- 线上工作室的数据没有同步到本地（两者不互通是设计如此）；本地种子
  id 与线上相同，但内容各自独立。
- 缩略图：本地不生成（`thumbnailPath` 为 null），前端用原图预览。
- `settingsText` 对 16 个种子里为空的字段的处理见“三、4”，未在线上验证过。
