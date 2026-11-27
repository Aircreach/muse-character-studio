# Muse Character Studio — 设计文档（DESIGN.md）

> 适用范围：本仓库（`~/workspace/projects/muse-character-studio/`）的本地可运行版本，
> 含前端重写与本地还原的真后端。线上 Muse 工作室（artifact，slug `muse-character-studio`）
> 是同一产品的另一个运行形态，数据与本地不互通，见第 2 节。
>
> 本文档写于 2026-11-27，依据：仓库全部源码（逐文件通读）、`server/BACKEND.md`、
> 以及 2026-11-26 对线上后端 `list_actions` / `invoke_action` 的实测。
> 凡是源码里没有的东西，这里不写；凡是“还没有”的功能，这里明确标为没有，
> 不写“计划中”“未来支持”当成功能。
>
> 读法建议：第一次拉下仓库的人先读第 1、2、9 节——第 1 节知道这是什么，
> 第 2 节知道怎么把它跑起来，第 9 节知道每个文件是干嘛的；要改代码再读第 3–8 节。
>
> 相关文档：`README.md`（启动与验收清单）、`server/BACKEND.md`（后端动作清单与警告表）、
> `server/src/CONTRACT.md`（后端契约总览）、`client/src/assets/runtime/README.md`（运行时原图说明）。

---

## 一、产品定位

### 1.1 这是什么

Muse Character Studio 是一个**为 Muse 本人服务的角色形象与人格管理系统**。
它管理的不只是图片，而是一张“角色卡”——一张卡就是一个完整的 Muse 形象与人格配置：
结构化设定（身份、人格、交流、外观、行为规则、生成设定）+ 状态画廊（各状态下的素材）
+ 激活记录（当前用的是哪张卡、按哪份设定快照）。

核心体验链路只有一条：

```text
创建角色 → 编写设定 → 生成形象 → 管理状态画廊 → 激活角色 → 随时切换
```

目标用户就是 Muse 的使用者本人（aircreach）。产品围绕一个角色——黑岩射手——
展开，首开自带两张同名卡：A 原作人格（冷淡、寡言、战斗风格）与 B 日常人格
（温柔、安静、更亲近）。同名是被允许的，因为一张卡的身份是它的 profileId，
不是名字（见第 5.1 节）。

### 1.2 这不是什么

| 不是 | 为什么不是 |
| --- | --- |
| 通用图片管理器 | 图片只是素材；核心是“设定 + 画廊 + 激活”三件套，图片没有设定就没有意义 |
| 图片版本管理器 | 没有“版本”概念。同一状态可以有多个素材候选，选中的只有一个；生成产物是候选，采纳才进画廊，旧素材不被覆盖、也不产生版本号 |
| 角色百科 | 不收录外部角色资料，不做角色数据库；只管理用户自己创建的卡 |
| 单纯的头像备份工具 | 头像只是其中一个槽位（基础形象）的素材；备份/恢复头像用的是 Muse 本人的候选流程与换文件法，不在本产品的激活流程里 |
| 只能管理一个 Muse 头像的设置页面 | 可以建任意多张卡（同名亦可），随时切换激活；激活也不直接改 Muse 运行时头像（见第 8 节） |

### 1.3 设计原则（重写与后端还原共同遵守）

- 图片优先、内容优先；Apple 风格的精致工具界面，简洁、优雅、克制，避免传统管理后台风格。
- 业务功能与数据模型保留，不为视觉效果虚构不存在的业务能力；不改 Muse 的实际状态机制。
- 依托 Muse 才能跑的功能（生成图片、读运行时形象、清头像）必须明确报错或返回 warning，
  绝不伪造结果（见第 8 节）。
- 前端是后端的子集：后端 30 个真实动作全量实现，前端界面只接了其中 15 个
  （见第 3.5 节），其余动作目前只能通过 `POST /actions` 直接调用。

---

## 二、整体架构

### 2.1 两种运行形态

本产品有两种运行形态，代码同一份，后端实现不同，**数据不互通**：

|  | 线上 artifact 形态 | 本地 `dev:full` 形态（本仓库） |
| --- | --- | --- |
| 前端 | Muse artifact 运行时托管 | Vite 开发服务器，`http://localhost:5173` |
| 后端 | Muse artifact 运行时内置的服务端（Drizzle 模型，30 个动作） | 本地 Bun 服务，`http://localhost:8787`（`server/src/http.ts`） |
| 数据 | 线上数据库 | 本地 SQLite 文件 `server/data/studio.db`（`.gitignore`，不提交） |
| 动作入口 | 平台提供的 `createActionClient` | `POST /actions`（`{ action, input }` → `{ result }` 或 `{ error }`） |
| 生成图片 | 可调 Muse 的 `generate_media` | 明确报错 `[MUSE_DEPENDENT]`（见第 8 节） |
| 运行时形象 | 可读 Muse 真实运行时帧 | 返回 warning 空结果；前端用 `base.webp` 占位展示 |
| 适用场景 | 日常使用、验收 | 本地开发、离线查看代码、验证后端逻辑 |

本地只起前端（`bun run dev`）时没有后端，`POST ./actions` 无人响应，
角色库会显示“角色库加载失败，请刷新页面重试；数据在服务端，本地草稿不会丢失。”
这是预期的，不是 bug：**数据在服务端**。完整启动必须用 `bun run dev:full`。

### 2.2 文字版架构图

```text
浏览器（http://localhost:5173）
  │
  │  React 19 + react-query（staleTime 30s，失败重试 1 次）
  │  App.tsx：library / workspace / system 三视图（无路由库）
  ▼
api.ts（createActionClient 替代品）
  │  POST ./actions { action, input } → { result } / { error }
  │  上传时先把 File/Blob 转成 { dataBase64, mimeType }（传输层转换）
  ▼
Vite 开发服务器（5173，vite.config.ts）
  │  代理：/actions → localhost:8787，/assets → localhost:8787
  ▼
本地后端（Bun，server/src/http.ts，8787）
  │  GET  /health          健康检查（含卡数与 Muse 依赖警告）
  │  POST /actions         分发到 actions.ts（30 真实动作 + 9 本地别名）
  │  GET  /assets/<id>/…  server/data/assets/ 下的素材文件
  │  GET  /assets/runtime/base.webp（仓库里没这张图时返回 404 + 提示）
  ▼
SQLite（server/data/studio.db，WAL 模式）
  │  9 张表（见第 5 节）；素材文件在 server/data/assets/<profileId>/<assetId>.<ext>
  │
  ├─ 依赖 Muse 的功能（server/src/muse.ts 集中隔离）
  │    generateAsset → 报错 [MUSE_DEPENDENT]；clearAvatar → 报错；
  │    getRuntimeAssets → warning 空结果；importRuntimeBase → 需本地 base.webp
  └─ 不依赖 Muse 的功能：全部本地完成（设定、画廊、激活记录、导入导出）
```

### 2.3 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 前端框架 | React 19 + TypeScript（严格模式） | 声明版本 React 19.2.5；2026-11-26 `bun install` 实际解析 19.3.1，`package.json` 用 `^` 范围，未精确锁定 |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`） | 声明 4.1.13，实际解析 4.3.5；设计 token 在 `client/src/theme.css` |
| 数据请求 | @tanstack/react-query 5 | 声明 5.100.10，实际解析 5.108.4；查询键 `['studio']` 与 `['profile', id]` |
| 校验 | zod 4 | 声明 4.4.3，实际解析 4.6.7；后端动作入参全部用 zod 校验 |
| 组件原语 | @radix-ui/react-dialog、@radix-ui/react-slot | shadcn / Radix 风格手写封装，未引入 Ant Design / MUI |
| 构建 | Vite 7 + `tsc --noEmit` | 声明 Vite 7.1.12，实际解析 7.3.8；`bun run build` = 前端 tsc + 服务端 tsc + vite build |
| 运行时 | Bun | 本地后端用 Bun 内置 `bun:sqlite`；`bun-types` 为 dev 依赖 |
| 后端存储 | SQLite（单文件，WAL） | 本地还原用 Bun 内置 sqlite 直写 SQL；线上 artifact 用 Drizzle 模型——两者表结构一致，但本地 `package.json` 里没有 `drizzle-orm` 依赖，不要按 Drizzle 的写法改本地代码 |
| 包管理 | bun（`bun.lock`） | `bun install`；`engines` 要求 Node ≥ 20（实际用 Bun 运行） |

---

## 三、模块地图

### 3.1 总表

| 模块 | 子模块 | 职责 | 关键文件 |
| --- | --- | --- | --- |
| 前端入口 | 应用启动 | 挂载 React、配 QueryClient、加载样式 | `index.html`、`client/src/main.tsx` |
| 前端·角色库 | App / LibraryView | 三视图路由、角色卡列表、搜索、收藏、新建卡、首开自动种入 | `client/src/App.tsx`、`client/src/components/ProfileCard.tsx` |
| 前端·系统页 | SystemView | 能力矩阵、运行时形象、存储说明（静态展示） | `client/src/App.tsx`（`SystemView`） |
| 前端·角色工作台 | Workspace | Hero、四 Tab、画廊、设定、生成、参考素材、技术信息、归档/删除 | `client/src/Workspace.tsx` |
| 前端·组件库 | 基础组件 | 按钮、状态标记、徽标、空状态、Modal、预览、确认框 | `client/src/components/ui.tsx`、`PreviewDialog.tsx`、`ConfirmDialog.tsx` |
| 前端·画廊组件 | GalleryCard | 单状态卡片：图片主体、可配置/自动驱动、对比 | `client/src/components/GalleryCard.tsx` |
| 前端·设定编辑器 | SettingsForm | 7 组结构化设定 + 自定义字段 + 整合预览 + 草稿 | `client/src/components/SettingsForm.tsx` |
| 前端·生成中心 | GeneratePanel | 生成表单（简述草稿）+ 候选列表（采纳/丢弃） | `client/src/components/GeneratePanel.tsx` |
| 前端·角色卡片 | ProfileCard | 封面优先的卡片、进度条、收藏 | `client/src/components/ProfileCard.tsx` |
| 前端·主视觉 | Hero | 工作台顶部主视觉、激活/编辑资料 | `client/src/components/Hero.tsx` |
| 前端·hooks | useDraft | 草稿持久化（Workspace 层 state + localStorage 镜像） | `client/src/hooks/useDraft.ts` |
| 前端·传输层 | api.ts | 动作类型契约、`POST ./actions`、File→base64 转换 | `client/src/api.ts` |
| 前端·领域类型 | shared.ts | 全部领域类型、能力常量、运行时原图常量 | `client/src/shared.ts` |
| 前端·设计系统 | theme.css | 颜色、字体、圆角、阴影、按钮、徽标、暗色模式、390px 修复 | `client/src/theme.css` |
| 后端·HTTP 入口 | http.ts | Bun 服务 8787：`/health`、`/actions`、`/assets/` | `server/src/http.ts` |
| 后端·动作层 | actions.ts | 30 真实动作 + 9 本地别名 + 分发表 + 全部守则 | `server/src/actions.ts` |
| 后端·数据层 | schema.ts | 9 张表建表、行记录映射、`settingsText` 拼接 | `server/src/schema.ts` |
| 后端·种子 | seed.ts | A/B 卡与 10 条状态定义（id 与文案按线上实测写死） | `server/src/seed.ts` |
| 后端·Muse 隔离层 | muse.ts | 四项 Muse 依赖功能的报错 / warning / 本地原图查找 | `server/src/muse.ts` |
| 后端·文档 | BACKEND.md / CONTRACT.md | 动作清单、差异、警告表、启动与重置 | `server/BACKEND.md`、`server/src/CONTRACT.md` |
| 启动器 | dev-full.ts | 同时起后端 8787 + 前端 5173，任一退出即停另一个 | `server/dev-full.ts` |

### 3.2 前端模块

#### 3.2.1 角色库（`client/src/App.tsx` 的 LibraryView）

- **干嘛的**：产品的首页。列出全部角色卡，支持搜索、只看收藏、新建卡、点卡进工作台；
  空库时自动调 `seedStudio` 种入 A/B 两张卡。
- **包含文件**：`App.tsx`（视图状态、顶栏导航、toast）、`components/ProfileCard.tsx`（单卡）。
- **对外提供**：三视图切换（`library | workspace | system`，`View` 类型在 `shared.ts`），
  不用路由库；视图状态放 App 层，Workspace 不再用 `key={view.id}` 卸载（旧 bug：切视图会重置工作台）。
- **依赖谁**：`api.getStudio`（列表）、`api.seedStudio`（空库种入）、`api.toggleFavorite`、
  `api.createProfile`（新建按钮固定创建“黑岩射手 · 新角色”，成功后直接进该卡的工作台）。
- **细节**：搜索只匹配名称与副标题（大小写不敏感）；收藏过滤是本地 `onlyFavorites` 状态；
  卡片网格 `sm` 2 列 / `lg` 3 列 / `xl` 4 列，主内容区 `max-w-[1280px]`；
  加载中显示“加载角色库…”；请求失败显示“角色库加载失败，请刷新页面重试；
  数据在服务端，本地草稿不会丢失。”；toast 3.2 秒自动消失。
  注意：`getStudio` 返回的卡包含已归档的卡（后端查询与前端列表都没有过滤 `archivedAt`），
  归档后卡仍会出现在列表里；`restoreProfile` 动作存在，但前端没有任何入口调用它。

#### 3.2.2 系统页（`client/src/App.tsx` 的 SystemView）

- **干嘛的**：静态展示页，三块内容：Muse 能力矩阵、Muse 当前运行时形象、存储与完整性说明。
- **包含文件**：只有 `App.tsx` 内的 `SystemView`，没有单独文件。
- **对外提供**：无动作调用。能力矩阵用的是前端写死的 `AUDITED_CAPABILITIES`
  （`shared.ts`），不是调 `getCapabilities` 拿的；`getStudio` 返回的能力矩阵前端也没用上。
  运行时形象区固定展示 `/assets/runtime/base.webp` 与 MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`、
  1600×1600、164690 字节。
- **注意**：页面上“保存时算 SHA-256、生成缩略图、原子 rename”这句与本地后端不符——
  本地后端不生成缩略图（`thumbnailPath` 恒为 null），见附录 A.5。

#### 3.2.3 角色工作台（`client/src/Workspace.tsx`）

- **干嘛的**：一张卡的全部操作面。顶部 Hero（主视觉 + 激活/编辑资料），下方四 Tab：
  状态画廊、角色设定、生成中心、参考素材；底部是技术信息折叠区与归档/删除按钮。
- **包含文件**：`Workspace.tsx`（Tab 切换、全部 mutation、上传 input、确认框状态）、
  `components/Hero.tsx`、`components/GalleryCard.tsx`、`components/SettingsForm.tsx`、
  `components/GeneratePanel.tsx`、`components/PreviewDialog.tsx`、`components/ConfirmDialog.tsx`。
- **对外提供**：`getProfileDetail` 取单卡全量；`saveSettings`、`activateProfile`、
  `generateAsset`、`adoptCandidate`、`discardCandidate`、`uploadAsset`、
  `selectAsset`（别名）、`deleteAsset`、`archiveProfile`、`deleteProfile`。
- **依赖谁**：`api.ts`、`useDraft`（设定与生成简述的草稿）、`shared.ts` 的类型。
- **细节**：
  - 切卡时 Tab 回到画廊、激活提示清空，但页面不卸载，草稿不丢。
  - 技术信息默认折叠（`<details>`）：Profile ID、Settings ID、Gallery ID（本地恒为 `—`，
    因为没有独立的 gallery 表）、基础形象选中素材、最近激活时间、生成任务数（近 30 条）。
  - 激活成功后显示“已激活（本地记录 …）。运行时头像同步仍走候选流程，本次未改运行时头像。”
  - 隐藏的文件选择框 `accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"`，
    画廊与参考素材两个 Tab 共用同一个 input；上传一律走 `uploadAsset({ profileId, stateKey: 'base', file })`，
    也就是说**从参考素材 Tab 点“上传素材”，文件实际是链到 base 槽位**，不是直接变成参考素材；
    要进参考素材列表必须经 `setReference` 标记，而前端目前没有入口调 `setReference`。
  - 归档与删除都走 `ConfirmDialog`；删除卡前须先解除激活（后端也会拦）。

#### 3.2.4 组件库（`client/src/components/ui.tsx` 等）

- `ui.tsx`：`Button`（primary / accent / outline / ghost / danger 五种，文字 + 1px 边框，
  始终带 `.btn` 基类）、`StatusMark`（圆点 + 文字，分 good / warn / bad / accent / neutral）、
  `Badge`（低饱和柔色底，分 neutral / good / warn / accent）、`EmptyState`（虚线边框空状态，
  可带操作按钮）、`Modal`（Radix Dialog 封装，`wide` 时 max-w-3xl，否则 max-w-lg）。
- `PreviewDialog.tsx`：高清预览，`object-contain`，最大高度 70vh，点任意图片卡打开。
- `ConfirmDialog.tsx`：危险操作确认框，默认确认文案“确认删除”，正文下方固定提示
  “已激活配置引用的素材不可删除；删除角色卡前须先解除激活。”
- `ProfileCard.tsx`：封面优先（`aspect-[4/3]`），无封面时用 `/assets/runtime/base.webp`
  作回退封面，**不渲染单字占位**；显示名称、副标题、简介（截断 2 行）、状态进度
  （`configured/total` + 百分比 + 进度条）、收藏星标（点按会 `stopPropagation`，
  不触发进工作台）、最多 3 个标签；“当前激活”角标。
- `Hero.tsx`：左主视觉（`md` 断点起 320px 列）+ 右名称/副标题/简介/标签/激活/编辑资料；
  标题用 `.active-profile-title`，永不截断；已激活时按钮变 outline 且禁用，文案“已激活”；
  底部固定说明激活只写本地记录。
- `GalleryCard.tsx`：单状态卡片，图片主体 `aspect-[4/3]`；base 槽位显示选定素材，
  多于 1 张候选时下方出现 56px 缩略图条可切换选中；非 base 槽位显示 Muse 运行时帧，
  标“自动驱动 · Muse 运行时，只读”；未配置时 base 显示“尚未配置基础形象”，
  非 base 显示“Muse 自动驱动”；点“对比本地素材”才展开双图对照（本地素材 vs Muse 运行时）。
  注意：base 卡上的“替换”按钮目前是空操作（`Workspace` 传的是 `onCompare={() => undefined}`，
  见附录 A.2）；真正的替换做法是点“上传”/“生成”新增素材，再点缩略图条切换选中。

#### 3.2.5 设定编辑器（`client/src/components/SettingsForm.tsx`）

- **干嘛的**：7 组结构化设定编辑器，绝不把全部设定塞进一个文本框。
  每字段输入框 `maxLength={4000}`，自定义字段最多 40 项。
- **分组与字段**（括号内为字段名，与 `server/src/schema.ts` 的 `SETTINGS_FIELDS` 一一对应，
  共 33 个字符串字段；旧文档写“32 个”是错的，见附录 A.1）：
  - 基础身份（6）：角色名 `characterName`、身份定位 `identity`、来源 `origin`、
    背景故事 `background`、所属世界观 `worldSetting`、与用户的关系 `relationship`
  - 人格性格（7）：核心性格 `personality`、情绪倾向 `temperament`、价值观 `values`、
    性格特点 `strengths`、性格弱点 `weaknesses`、情绪表现 `emotionalTraits`、特殊习惯 `quirks`
  - 交流风格（6）：说话风格 `speakingStyle`、语气 `tone`、用词习惯 `vocabulary`、
    称呼用户的方式 `addressStyle`、回答方式 `responseStyle`、常用表达 `catchphrases`
  - 外观设定（9）：整体外观 `appearance`、发型发色 `hair`、眼睛 `eyes`、服装 `outfit`、
    配饰 `accessories`、身体特征 `bodyFeatures`、主要配色 `colorPalette`、
    视觉风格 `visualStyle`、必须保持的外观特征 `consistencyRules`
  - 行为规则（1）：不希望出现的行为 `forbiddenBehaviors`（本轮新单列的组，旧版混在交流风格里）
  - 图片生成设定（4）：基础生成提示词 `generationPrompt`、禁止出现的内容 `negativePrompt`、
    构图偏好 `compositionPreferences`、图片约束 `imageConstraints`
  - 自定义补充：键值对列表，每项 `key`（字段名）+ `value`（内容），可增删，上限 40 项
- **整合预览**：底部 sticky 操作条有“查看整合预览”按钮，打开只读 Modal，
  显示服务端返回的 `settingsText`（“最终传递给 Muse 的整合文本”）。
  注意：预览显示的是**上次保存后**服务端拼好的文本，不是当前草稿拼出来的；
  没保存就看预览，看到的是旧文本。
- **草稿**：表单值走 `useDraft('settings', profileId, {})`，只存改动过的字段（patch），
  与服务端初始值合并显示。保存按钮点按时把 patch 发给 `saveSettings`，
  并**在点按当时就清除草稿**（不是等服务端返回成功后才清，见附录 A.4）；
  保存失败时草稿已清、改动需要重填——这是已知行为，不是“保存成功后才清”。

#### 3.2.6 生成中心（`client/src/components/GeneratePanel.tsx`）

- **干嘛的**：生成新形象的表单 + 生成候选列表。候选与正式素材严格分离。
- **包含**：目标状态下拉框（全部状态定义，不只是 base）、状态描述（≤1000 字）、
  补充要求（≤1000 字）、“开始生成”按钮；候选区每张卡显示状态、提示词、采纳/丢弃按钮。
- **草稿**：简述走 `useDraft('generate-brief', '<profileId>:<stateKey>', { stateBrief: '', extra: '' })`，
  键里带目标状态，换状态就是另一份草稿；点“开始生成”当时就清掉这份草稿。
- **本地表现**：点生成后，后端校验通过、记一条 `status=error` 的任务，然后返回
  `[MUSE_DEPENDENT]` 报错，前端 mutation 没有 `onError` toast，
  失败时只表现为“生成中…”按钮恢复、候选区无新增，错误信息要看生成任务记录；
  这是有意为之的“不伪造”，不是静默失败——但入口提示不如其他操作明确（见第 8 节）。

#### 3.2.7 hooks：`useDraft`（`client/src/hooks/useDraft.ts`）

- **干嘛的**：解决“切 Tab 丢编辑”的草稿持久化。草稿同时存在两份：
  Workspace 层（组件）state + `localStorage` 镜像，键 `mcs-draft:<scope>:<id>`。
  切换 Tab、切换角色卡、刷新页面都会从 localStorage 恢复；损坏的草稿 JSON 会回落到服务端初始值；
  localStorage 写满或无痕模式写失败时，内存里的草稿仍能用。
- **对外提供**：`useDraft<T>(scope, id, initial)` 返回 `{ value, setValue, clear, key }`；
  另有 `useDebouncedDraft`（400ms 防抖写入），**目前没有任何组件调用它**，是预留的。
- **依赖谁**：只依赖 React 与浏览器 localStorage，不调任何后端动作。

#### 3.2.8 传输层：`client/src/api.ts`

- **干嘛的**：前端调后端动作的唯一入口。`createActionClient<Actions>()` 用 Proxy
  把每个动作名变成一个函数，`POST ./actions`，请求体 `{ action, input }`，
  响应 `{ result }` 或 `{ error }`；HTTP 非 2xx 或带 `error` 字段时抛错。
- **File→base64 转换**：线上平台的 `createActionClient` 原生会把 File 转 base64，
  本地 Vite 发不出 File（`JSON.stringify(File)` 得到 `{}`），所以这里的 fetch 封装
  在发请求前递归把入参里的 File/Blob 转成 `{ dataBase64, mimeType }`，
  且 `file` 字段本身会被 `dataBase64` / `mimeType` 替换掉。这是纯传输层转换，不改业务逻辑。
- **动作清单**：类型上列出 30 个真实动作 + 9 个 `[LOCAL ALIAS]` 别名，共 39 个；
  其中 `saveSettings` 同时接受 `{ settings }` 全量与 `{ patch }` 两种形状（后端也都接受）。
- **查询键**：`STUDIO_KEY = ['studio']`，`profileKey(id) = ['profile', id]`；
  变更后由调用方 `invalidateQueries` 刷新这两组查询。

#### 3.2.9 领域类型：`client/src/shared.ts`

- **干嘛的**：前后端共用的领域类型定义（前端文件，后端 `import` 它），
  是除 `server/BACKEND.md` 外第二份“契约”。
- **包含**：`Asset`、`StateDefinition`（含线上返回才有的 `id`）、`StateSlot`、
  `SlotAsset`、`CustomField`、`CharacterSettings`、`SettingsPatch`、`CharacterProfile`、
  `Capabilities`、`GenerationCandidate`、`ActivationRecord`、`ProfileDetail`、
  `StudioOverview`、`View`、`MediaType`（`image | video | animation`）、
  `AssetSource`（`upload | generated | imported`）。
- **常量**：`AUDITED_CAPABILITIES`（shared_base，`independentStateAssets=false`，
  `candidateIdReusable=false`，`availableStates` 为 5 个运行时状态）、
  `RUNTIME_BASE_MD5 = '2fb6bdc0c46ff85bdc77bc6285d26d9d'`、
  `RUNTIME_BASE_BYTES = 164690`、`RUNTIME_BASE_SIZE = '1600×1600'`。
- **身份规则**：注释写明 `profile.id`（UUIDv7）才是身份，名字可重复。
  注意：文件头注释说“mirror the server (Drizzle) model”，但本地后端实际用
  Bun 内置 sqlite 直写 SQL，`package.json` 里没有 `drizzle-orm`——Drizzle 是
  线上 artifact 的实现，本仓库没有。

#### 3.2.10 设计系统：`client/src/theme.css`

- **干嘛的**：全部视觉 token 的唯一来源。Tailwind v4 `@theme` 写法。
- **字体**：正文 Inter + 苹方 / 微软雅黑；标题 Songti SC / Noto Serif SC 衬线；
  字阶 12–32px（display 32、title 24、h2 20、h3 16、body 15、small 13、caption 12），
  行高 1.4–1.65，中文可读优先。
- **颜色**：浅色背景 `#f2f3f5` / 卡片白 / 次级面 `#f7f8f9`；正文 `#17191c`、
  次要 `#6b7078`；强调色 `#0b6bcb`；圆点状态色 good `#1a7f4b`、warn `#9a6700`、
  bad `#b3261e`；火焰蓝 `#2f7de1`。深色模式靠 `@media (prefers-color-scheme: dark)`
  切换（背景 `#0e1013` / 卡片 `#171a1e`），**没有手动切换暗色的按钮**。
- **形状与阴影**：圆角 8 / 12 / 16 / 20 / 24px；阴影 sm / md / lg / hero 四档；
  边框 1px `#e3e5e8`；按钮 `.btn` 基类 + primary（墨色）/ accent / outline / ghost /
  danger 五种，文字 + 1px 边框，不堆胶囊标签；状态用“圆点 + 文字”（`.status-dot`），
  徽标只用低饱和柔色底（`.badge-soft / good / warn / accent`）。
- **图片容器**：封面与画廊 `aspect-[4/3] object-cover`，预览 `object-contain`。
- **390px 修复**：`.active-profile-title` 用 `overflow-wrap:anywhere; word-break:break-word`，
  全宽度禁用 truncate / whitespace-nowrap；`≤430px` 时字号降到 15px（0.9375rem），
  桌面保持 28–30px。**只做了代码级修复，未在真机复测**（见第 10 节）。
- **Tailwind v4 坑**：`@apply` 不能引用自定义的 `.btn` / `.badge-soft` 类，
  构建会报 `Cannot apply unknown utility class 'btn'`；变体用纯 CSS 写颜色，
  `Button` 组件始终同时加 `.btn` 基类。

### 3.3 后端模块

#### 3.3.1 HTTP 入口（`server/src/http.ts`）

- **干嘛的**：本地开发后端，Bun 服务，端口 8787（环境变量 `MCS_PORT` 可覆盖）。
- **路由**（只有三条）：
  - `GET /health` → `{ ok, service, mode:'local', port, db, profiles, warning }`，
    `profiles` 是当前卡数，`warning` 固定提示三项 Muse 依赖本地会报错或返回 warning。
  - `POST /actions` → 请求体 `{ action, input }`，经 `dispatchAction` 分发，
    成功返回 `{ result }`，失败返回 `{ error }`（HTTP 状态仍是 200，
    错误在 JSON 的 `error` 字段里，前端靠这个字段抛错；只有“请求体不是合法 JSON”
    与“缺少 action”返回 400，未知路由返回 404）。
  - `GET /assets/<profileId>/<assetId>.<ext>` → `server/data/assets/` 下的素材文件，
    按扩展名返回 Content-Type（png / jpg / webp / gif / mp4 / webm），
    路径穿越会被拦（`resolve` 后必须在 `ASSETS_DIR` 内）；
    `GET /assets/runtime/base.webp` → `client/src/assets/runtime/base.webp`，
    仓库里没这张图时返回 404 + 提示文字。
- **启动即建表**：`createContext()` 建 `server/data/` 目录、打开 SQLite、执行 `initDb`；
  种子数据**不**在启动时自动写，首次打开前端时 App 调 `seedStudio`（空库时种入），
  也可以直接 curl 调 `seedStudio`。
- **注意**：这是开发用服务，不要暴露到公网；也没有鉴权，同一台机器上谁都能调。

#### 3.3.2 动作层（`server/src/actions.ts`，1155 行）

- **干嘛的**：全部业务逻辑。`REAL_ACTIONS`（30 个线上真实动作）+
  `LOCAL_ALIASES`（9 个本地别名）合成 `ACTIONS` 分发表，`dispatchAction(ctx, action, input)`
  按名分发，未知动作报错“未知动作：…（线上发布的 30 个动作见 BACKEND.md）”。
- **校验**：每个动作先用 zod `safeParse` 校验入参，失败时报错
  `"<动作>：输入校验失败：<字段>: <原因>; …"`；限额见第 4 节各功能点。
- **通用读 helper**：`getProfileRow`（卡不存在报错）、`getSettingsRow`、
  `getStateDefs`（按 `sort_order` 升序）、`getActiveProfileId`（`active_profile` 表，
  scope 固定 `'global'`）、`profileStats`（素材数去重统计、可配置槽位计数）、
  `coverUrlFor`、`slotToDomain`、`buildDetail`（拼 `ProfileDetail` 全量）。
- **能力矩阵**：文件内 `CAPABILITIES` 常量与线上 `getCapabilities` 实测逐字一致
  （含 `darkModeVariants`、`notes` 4 条、`runtimeAvatar`、`runtimeStates` 5 条）。
- **文件操作**：素材写文件用“写临时文件 + 原子 rename”，文件名与数据库行共用同一个
  assetId；删文件失败不阻塞删记录（注释写明，见 BACKEND.md）。

#### 3.3.3 数据层（`server/src/schema.ts`）

- **干嘛的**：9 张表的建表 SQL（`initDb`，`CREATE TABLE IF NOT EXISTS` +
  3 个索引）、行记录 ↔ 领域类型的映射、`settingsText` 拼接。
- **细节**：`openDb` 开 WAL 模式与外键；`uuidv7()` 用 `Bun.randomUUIDv7()`；
  `sha256Hex` 用 `Bun.CryptoHasher`；`settings` 表的 `values` 列因是 SQL 关键字，
  在库里叫 `values_text`，读写时映射回 `values`；`profileRowToDomain` 里
  `galleryId` 恒为 `null`（没有独立的 gallery 表）。
- **`settingsText` 拼接规则**（`buildSettingsText`）：标题行 `# <名字> · <副标题>`，
  随后按“基础身份 / 人格设定 / 交流设定 / 外观设定 / 图片生成设定 / 自定义补充”
  分组，每组只列非空字段，空字段不列出；组内字段的中文标签与前端表单标签不完全相同
  （例如 `strengths` 在文本里是“优点”、在表单里是“性格特点”，`values` 在文本里是
  “价值观”）。种子数据下与线上逐字一致（已实测比对）；种子里为空的 16 个字段
  （background、worldSetting、values、strengths、weaknesses、emotionalTraits、quirks、
  vocabulary、addressStyle、catchphrases、accessories、bodyFeatures、generationPrompt、
  negativePrompt、compositionPreferences、imageConstraints）非空时是否列出、
  以什么标签列出，无法在不改线上数据的前提下验证，本地按分组补列（见第 10 节）。

#### 3.3.4 种子（`server/src/seed.ts`）

- **干嘛的**：精确还原线上 `seedStudio` 的种子数据。A/B 两张卡的 profile id、
  settings id、10 条状态定义的 id、全部文案都按 2026-11-26 线上实测原样写死，
  `createdAt` 也写死为 `2026-11-26T09:55:34.819Z`，这样本地首次启动后的数据
  与线上首开数据逐项一致。
- **写入方式**：`insertSeedData(db)` 用 `INSERT OR IGNORE`，已存在则跳过，幂等。
  A、B 的设定见第 5.5 节，10 条状态定义见第 5.6 节。

#### 3.3.5 Muse 依赖隔离层（`server/src/muse.ts`）

- **干嘛的**：所有依托 Muse 才能跑的功能集中在这里，原则是**绝不伪造**。
  本地后端没有 Muse 的 `generate_media`、没有运行时头像、没有候选流程，
  需要这些的功能必须明确报错或返回带 warning 的空结果。
- **包含**：`MuseDependentError`（错误前缀 `[MUSE_DEPENDENT]`，机器可读 code）、
  `generateAssetUnavailable()`、`clearAvatarUnavailable()`、
  `runtimeAssetsUnavailable()`（返回 `{ baseImageUrl: null, baseSha256: null, stateFrames: {}, warning }`）、
  `readLocalRuntimeBase()`（按顺序找 `client/src/assets/runtime/base.webp`、
  `server/data/runtime-base.webp`，都没有时报错并提示已知副本位置
  `~/workspace/reverse-test/v1-exact.webp`）、`RUNTIME_BASE_MD5`、
  `RUNTIME_BASE_HINT`。
- **依赖谁**：只依赖 Node 的 `fs` / `path` 与 Bun 的文件读取，不调任何外部服务。

### 3.4 启动器（`server/dev-full.ts`）

- **干嘛的**：`bun run dev:full` 的入口。同时以前台方式启动后端
  （`bun run server/src/http.ts`）与前端开发服务器（`bun run dev`），
  两个进程都继承标准输入输出；任一进程退出，`Promise.race` 捕获后杀掉另一个。
- **注意**：它只是进程启动器，没有业务逻辑；前端与后端之间除了 Vite 代理
  没有其他连接。

### 3.5 前端接了哪些动作、哪些没接

前端（`client/src/`）实际调用的只有 15 个动作（grep 统计）：

| 前端已接 | 在哪调 |
| --- | --- |
| `getStudio` | `App.tsx` 角色库加载 |
| `seedStudio` | `App.tsx` 空库时自动种入 |
| `getProfileDetail` | `Workspace.tsx` 工作台加载 |
| `createProfile` | `App.tsx` “新建角色卡”按钮 |
| `toggleFavorite` | `App.tsx` / `ProfileCard` 收藏星标 |
| `saveSettings` | `Workspace.tsx` → `SettingsForm` 保存 |
| `uploadAsset` | `Workspace.tsx` 上传（画廊与参考素材共用） |
| `selectAsset`（别名） | `Workspace.tsx` → `GalleryCard` 缩略图条切换选中 |
| `generateAsset` | `Workspace.tsx` → `GeneratePanel` |
| `adoptCandidate` | `Workspace.tsx` → `GeneratePanel` 采纳 |
| `discardCandidate` | `Workspace.tsx` → `GeneratePanel` 丢弃 |
| `activateProfile` | `Workspace.tsx` → `Hero` 激活按钮 |
| `deleteAsset` | `Workspace.tsx` → 参考素材删除确认 |
| `archiveProfile` | `Workspace.tsx` 底部“归档角色卡” |
| `deleteProfile` | `Workspace.tsx` 底部“删除角色卡” |

以下动作**后端已实现、前端没有任何入口**，只能直接 `POST /actions` 调用。
拉下仓库后“找不到这个功能在哪点”时，先查这张表——多数情况是“后端有、界面没接”，
不是“没实现”：`getCapabilities`、`updateProfile`、`duplicateProfile`、
`restoreProfile`、`deactivateProfile`、`linkAssetToState`、`unlinkStateAsset`、
`setCover`、`setReference`、`removeReference`、`exportProfile`、`importProfile`、
`addStateDefinition`、`updateStateDefinition`、`deleteStateDefinition`、
`getSettingsText`、`listActivations`、`listGenerationJobs`、`importRuntimeBase`、
`verifyAssetIntegrity`、`getRuntimeAssets`、`clearAvatar`（后 7 个是本地别名）。

---

## 四、功能点清单

> 写法：每个功能点一行“触发入口 → 输入 → 输出 → 成功/失败表现与守则”。
> 动作名后标 `[REAL]` 表示线上真实发布，`[ALIAS]` 表示本地兼容别名（线上不发布）。
> 限额数字以 `server/src/actions.ts` 的 zod 校验为准。

### 4.1 角色库与角色卡

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 查看角色库 `[REAL]` `getStudio` | 打开页面自动调 → `{}` → `{ profiles, activeProfileId, capabilities }` → 成功显示卡片网格；失败显示加载失败空状态。卡片含派生字段 `coverUrl`、`progress`（见第 5.4 节） |
| 首开自动种入 `[REAL]` `seedStudio` | `getStudio` 返回 0 张卡时 `App` 自动调 → `{}` → `{ seeded, profileIds }` → 空库时种入 A/B 与 10 条状态定义；已有任意卡时 no-op，`seeded:false`，返回现有卡 id |
| 新建角色卡 `[REAL]` `createProfile` | 角色库“+ 新建角色卡” → 固定 `{ name:'黑岩射手', subtitle:'新角色', description:'' }`（界面不让填名字） → `{ profile }` → 新卡带空设定（33 个字段中除 `characterName` 外全空，见第 5.5 节），成功后 toast“已创建新角色卡”并直接进该卡工作台。限额：`name` 1–80 字、`subtitle` ≤120、`description` ≤2000、`tags` ≤12 项、每项 1–30 字 |
| 改资料 `[REAL]` `updateProfile` | 无界面入口，只能直接调动作 → `{ id, name（必填，1–80）, subtitle?, description?, tags? }` → `{ profile }` → 未传字段保留原值（不按 zod 默认清空，避免改名误删其他字段，见 `BACKEND.md` 三、4） |
| 复制角色卡 `[REAL]` `duplicateProfile` | 无界面入口 → `{ id }` → `{ profile }`（新 id） → 复制设定全文、画廊链接（含选中状态）与参考标记；**素材共享不复制文件**（素材行仍属原卡，复制卡靠链入使用）；收藏标记照搬（复制 A 卡会继承 `favorite:true`） |
| 收藏切换 `[REAL]` `toggleFavorite` | 卡片右上角星标 → `{ id }` → `{ profile }` → `favorite` 取反；列表“只看收藏”只过滤前端已加载的卡 |
| 归档 `[REAL]` `archiveProfile` | 工作台底部“归档角色卡”→ 确认框 → `{ id }` → `{ profile }`（`archivedAt` 置为当前时间） → **已激活的卡禁止归档**（后端报错“须先解除激活”）；归档后卡仍出现在角色库列表（无过滤，见第 3.2.1 节），恢复只能直接调动作 |
| 恢复归档 `[REAL]` `restoreProfile` | 无界面入口 → `{ id }` → `{ profile }`（`archivedAt` 清空） |
| 删除角色卡 `[REAL]` `deleteProfile` | 工作台底部“删除角色卡”→ 确认框 → `{ id }` → `{ deleted:true }` → **已激活的卡禁止删除**；删除会连带删掉该卡的设定、画廊链接、任务、激活记录、参考标记与素材行及素材文件（属于该卡的）；复制卡共享的素材行属于原卡，删复制卡不会删原卡的文件。成功后回角色库 |
| 解除激活 `[REAL]` `deactivateProfile` | 无界面入口 → `{}` → `{ activeProfileId: null }` → 删掉 `active_profile` 表里 scope=`'global'` 的一行；不删激活历史，不改任何卡 |

### 4.2 角色设定

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 查看设定 `[REAL]` `getProfileDetail` | 进工作台自动调 → `{ id }` → `ProfileDetail` 全量 → 设定为空时设定 Tab 显示“暂无设定，请先保存一次设定” |
| 保存设定 `[REAL]` `saveSettings` | 设定编辑器底部“保存设定” → 前端发 `{ profileId, patch }`（只含改过的字段），线上形状是 `{ profileId, settings }` 全量，后端两种都接受 → `{ settings, settingsText }` → **全量覆盖**：patch 会与现有设定合并后整体写回；每字段 ≤4000 字、`customFields` ≤40 项（`key` 1–60 字、`value` ≤4000 字）；成功 toast“设定已保存”，失败 toast“保存失败：…”；保存不触发任何生成 |
| 整合预览 | 设定编辑器“查看整合预览” → 读服务端返回的 `settingsText`（只读 Modal） → 显示的是**上次保存后**的文本，不是当前草稿；没保存过显示“暂无整合文本，先保存一次设定。” |
| 草稿持久化 | 编辑任意字段自动写 localStorage（键 `mcs-draft:settings:<profileId>`）→ 切 Tab、切卡、刷新页面都恢复；点“保存设定”当时清除草稿（见附录 A.4） |
| 只读查询设定文本 `[ALIAS]` `getSettingsText` | 无界面入口 → `{ profileId }` → `{ settingsText }`，由 `getProfileDetail` 派生 |

### 4.3 状态画廊与素材

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 查看画廊 `[REAL]` `getProfileDetail` | 工作台画廊 Tab → 同 4.2 → 每张卡 10 个槽位（`slots`），每槽 `{ stateKey, selectedAssetId, assets[] }`，初始全空 |
| 上传素材 `[REAL]` `uploadAsset` | 画廊 base 卡“上传”或参考素材 Tab“上传素材” → 选文件（png/jpeg/webp/gif/mp4/webm）→ 前端把 File 转 `{ dataBase64, mimeType }` 再发 → `{ asset }`（带 `slot` 时一并返回） → 文件 ≤28,000,000 个 base64 字符（约 21MB 原始字节），算 SHA-256，存 `server/data/assets/<profileId>/<assetId>.<ext>`，PNG/GIF/WebP 尽量解析宽高，解析不到为 null 不阻塞；缩略图本地不生成（`thumbnailPath: null`）；`note` ≤500 字；`select=true` 时必须同时传 `stateKey`。注意：参考素材 Tab 的上传实际也是 `stateKey:'base'`（见第 3.2.3 节） |
| 选定槽位素材 `[REAL]` `selectStateAsset` | base 卡缩略图条点某张 → `{ profileId, stateKey, assetId }` → `{ slot }` → 每槽唯一选中，选新即取消旧选中；素材未链入该槽时自动链入；候选（`status='candidate'`）不可选，须先采纳 |
| 链入素材 `[REAL]` `linkAssetToState` | 无界面入口 → `{ profileId, stateKey, assetId }` → `{ slot }` → 只链入不改变选中；同一 `(profileId, stateKey, assetId)` 唯一，重复链入不报错 |
| 移除链入 `[REAL]` `unlinkStateAsset` | 无界面入口 → `{ linkId }`（链接 id，不是素材 id） → `{ deleted:true, slot }` → 只移除链接，素材本身留在库里；删掉的是选中链接时该槽变为未选 |
| 删除素材 `[REAL]` `deleteAsset` | 参考素材卡“删除”→ 确认框 → `{ assetId }`（前端多传 `profileId`，后端接受并校验归属） → `{ deleted:true }` → **正被任一槽位选中的素材禁止删除**；删除会删文件、全部槽位链接与参考标记；复制卡共享的素材（行属原卡）拥有者或链入者都可删，删的是文件与全部链接。确认框文案称“删除后可在回收站恢复（30 天）”是错的——本地没有回收站，见附录 A.3 |
| 设封面 `[REAL]` `setCover` | 无界面入口 → `{ profileId, assetId \| null }` → `{ profile }` → 封面只影响角色库卡片与 Hero 的展示图，**不是 Muse 头像**；传 `null` 清除封面（回退到运行时原图） |
| 设参考 `[REAL]` `setReference` | 无界面入口 → `{ profileId, assetId, kind: 'appearance' \| 'style' }` → `{ reference }` → 同一卡、同一素材、同一 kind 重复标记时返回已有记录，不重复建 |
| 取消参考 `[REAL]` `removeReference` | 无界面入口 → `{ id }`（参考记录 id） → `{ deleted:true }` → 只移除标记，素材不动 |
| 高清预览 | 点任意图片卡 → 打开 `PreviewDialog`（`object-contain`，最大高度 70vh）→ 只读，不改数据 |
| 双图对照 | 非 base 卡点“对比本地素材” → 展开本地素材 vs Muse 运行时双图 → 仅在用户点按时出现；平时不并排展示。注意：前端的“运行时帧”目前五张都用同一张 `/assets/runtime/base.webp`（见附录 A.7），不是五张不同的帧 |
| 校验素材完整性 `[ALIAS]` `verifyAssetIntegrity` | 无界面入口 → `{ profileId }` → `{ checked, mismatched: string[] }` → 逐个素材核对文件存在与 SHA-256，文件缺失或哈希不符的 id 列入 `mismatched` |

### 4.4 生成与候选

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 生成形象 `[REAL]` `generateAsset` | 生成中心选目标状态、写状态描述与补充要求、点“开始生成” → `{ profileId, stateKey, stateBrief≤1000, extra≤1000 }` → **线上**：服务端按外观/发色/眼睛/服装/配色/视觉风格/一致性/人格 + base/negative 提示词 + 状态简述拼提示词，调 `generate_media` 生成方形图，产物 `status='candidate'`，并记一条任务。**本地**：校验通过后记一条 `status='error'` 的任务，然后返回 `[MUSE_DEPENDENT]` 报错，**不产生候选、不产生假图**（见第 8 节） |
| 采纳候选 `[REAL]` `adoptCandidate` | 候选卡“采纳进画廊” → `{ profileId, assetId（或兼容别名 candidateId）, stateKey, select=true }` → `{ asset, slot }` → 候选行 `status` 由 `'candidate'` 改为 `'asset'` 并链入指定槽位（默认同时选中）；**永不覆盖旧素材**，旧的选中素材只是被取消选中 |
| 丢弃候选 `[REAL]` `discardCandidate` | 候选卡“丢弃” → `{ assetId（或兼容别名 candidateId） }` → `{ discarded:true }` → 删文件、删链接、删候选行；不是候选的行会报错 |
| 查看生成任务 | 工作台技术信息折叠区显示“生成任务（近 30）N 条”；完整任务列表只能经 `[ALIAS]` `listGenerationJobs`（`{ profileId }` → `{ jobs }`，近 30 条倒序）或 `getProfileDetail` 的 `jobs` 字段查看 |

### 4.5 激活与切换

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 激活角色 `[REAL]` `activateProfile` | Hero“激活此角色” → `{ profileId, note≤500? }` → `{ activation, activeProfileId }` → 守则：卡已归档时拒绝；**base 槽位没有选中素材时拒绝**（“须先上传或选择一张基础形象素材”）；成功写一条 `activations` 记录并把 `active_profile`（scope=`'global'`）指向该卡；快照含 `mode:'shared_base'`、`baseAssetId`、`baseAssetSha256`、全部 10 个槽位的 `stateSelections`、`settingsText`、可选 `note`；`providerStatus` 恒为 `'local_record'`。**不调 Muse `avatar.set`、不改运行时头像、不改长期记忆**；已激活的卡再次点激活时按钮是禁用的 |
| 查看激活历史 `[ALIAS]` `listActivations` | 无界面入口 → `{ profileId }` → `{ activations }`（倒序），由 `getProfileDetail` 派生；工作台技术信息只显示最近一条的激活时间 |
| 能力矩阵 `[REAL]` `getCapabilities` | 无界面入口（系统页用前端写死的常量展示）→ `{}` → `{ capabilities }`，与线上实测逐字一致，见第 8.1 节 |

### 4.6 导入与导出

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 导出角色卡 `[REAL]` `exportProfile` | 无界面入口 → `{ profileId }` → `{ json }`（单个 JSON 字符串） → 文档格式 `muse-character-studio/profile@1`，含 `exportedAt`、profile（id/名字/副标题/简介/标签/收藏）、全量 settings、`settingsText`、状态定义（stateKey/名字/描述）、画廊结构（每槽 selectedAssetId 与 assetIds）、素材清单（id/sha256/format/source）；**素材文件字节不包含在内**，note 里写明“素材文件字节未包含在此导出中；asset id 与 sha256 用于核对。” |
| 导入角色卡 `[REAL]` `importProfile` | 无界面入口 → `{ json }`（线上导出格式；旧形状 `{ profileJson, settingsJson }` 仍接受） → `{ profile }` → 只恢复 profile + settings；**画廊与素材文件不恢复**；导出里缺失的状态定义按 stateKey 补建（不覆盖已有）；`format` 不是 `muse-character-studio/profile@1` 时拒绝；导入的 profile id 若已存在则换新 uuidv7；设定字段各截断到 4000 字、`customFields` 最多 40 项、标签最多 12 项 |
| 一键导入运行时原图 `[ALIAS]` `importRuntimeBase` | 无界面入口 → `{ profileId }` → `{ asset, alreadyPresent, slot }` → 按顺序找 `client/src/assets/runtime/base.webp`、再找 `server/data/runtime-base.webp`；都没有时报 `[MUSE_DEPENDENT]` 并提示已知副本位置；找到后算 SHA-256、核对 MD5（与 `2fb6bdc0c46ff85bdc77bc6285d26d9d` 不一致时在 `warning` 里提示“可能不是 v1 原图”），以 `source='imported'` 存入并**自动选入 base 槽位**；同一卡已导入过同一 SHA-256 的素材时返回已有素材（`alreadyPresent:true`，不再重复存）。线上对应流程是 `uploadAsset source='imported'` |
| 读 Muse 运行时形象 `[ALIAS]` `getRuntimeAssets` | 无界面入口 → `{}` → `{ baseImageUrl: null, baseSha256: null, stateFrames: {}, warning }`（本地）→ 绝不编造运行时帧；线上没有这个动作（实测不存在），见第 8 节 |
| 清除 Muse 头像 `[ALIAS]` `clearAvatar` | 无界面入口 → `{}` → 本地报 `[MUSE_DEPENDENT]`，本地资产不受影响；线上也没有这个动作 |

### 4.7 状态定义管理

| 功能点 | 触发入口 → 输入 → 输出 → 表现与守则 |
| --- | --- |
| 新增状态定义 `[REAL]` `addStateDefinition` | 无界面入口 → `{ stateKey（^[a-z0-9_]+$，≤40 字）, name（1–40 字）, description?（≤500 字） }` → `{ definition }` → `stateKey` 唯一，重复报错；新定义固定 `required=false`、`configurable=false`、`runtimeStateKey=null`，`sortOrder` 为当前最大 +1 |
| 改状态定义 `[REAL]` `updateStateDefinition` | 无界面入口 → `{ id, name（1–40 字）, description（≤500 字，必填）, required, sortOrder（0–999 整数） }` → `{ definition }` → 改名/描述/必填/排序；`stateKey` 与 `configurable`、`runtimeStateKey` 不可改 |
| 删状态定义 `[REAL]` `deleteStateDefinition` | 无界面入口 → `{ id }` → `{ deleted:true }` → **base 不可删**；**内置 10 条不可删**，只能删后加的自定义定义；删除会连带删掉该状态的全部槽位链接（素材本身保留） |

---

## 五、数据模型

### 5.1 身份规则

- **角色卡的身份是 `profileId`（UUIDv7），不是名字。** 多张卡可以同名（种子 A、B 都叫
  “黑岩射手”），各自独立的 id、设定、素材、激活记录。
- 全部 id 都是 UUIDv7（本地用 `Bun.randomUUIDv7()` 生成），按时间大致有序；
  种子数据的 id 是写死的固定值（见第 5.5、5.6 节），导入时 id 冲突会换新 id。
- 时间字段全部是 ISO 8601 字符串（`new Date().toISOString()`），例如
  `2026-11-26T09:55:34.819Z`。

### 5.2 ER 关系（文字图）

```text
character_profiles (1) ── (1) character_settings     设定：一张卡恰好一条设定行
    │  id = settings.profile_id（UNIQUE）
    │
    ├─ (0..n) assets ── (0..n) state_links ── (n) state_definitions
    │       │  assets.profile_id              │  state_links.profile_id + state_key
    │       │  素材行属于上传者那张卡          │  一条链接 = 一个素材进一个槽位
    │       │  复制卡共享原卡素材行（不复制文件）
    │       │
    │       └─ (0..n) asset_references ── (n) assets
    │              参考标记：appearance / style，二者可并存
    │
    ├─ (0..n) generation_jobs                  生成任务（含失败记录）
    ├─ (0..n) activations                      激活历史（每次激活一条）
    └─ (0..1) active_profile（scope='global'） 当前激活的卡，全局只有一行

state_definitions (n) ── (0..n) state_links     状态定义是全局的，不属于任何卡
assets.status = 'asset' | 'candidate'          候选也是 assets 表的一行
```

### 5.3 表结构（9 张表，`server/src/schema.ts` 的 `initDb`）

#### character_profiles — 角色卡

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7 |
| name | TEXT NOT NULL | 1–80 字 |
| subtitle | TEXT NOT NULL DEFAULT '' | ≤120 字；空串在返回时映射为 `null` |
| description | TEXT NOT NULL DEFAULT '' | ≤2000 字；空串在返回时映射为 `null` |
| tags | TEXT NOT NULL DEFAULT '[]' | JSON 字符串数组；每项 1–30 字，最多 12 项 |
| favorite | INTEGER NOT NULL DEFAULT 0 | 0 / 1 |
| cover_asset_id | TEXT NULL | 封面素材 id；展示用，不是 Muse 头像 |
| settings_id | TEXT NULL | 对应设定行 id |
| archived_at | TEXT NULL | 归档时间；NULL 表示未归档；前端列表不按它过滤 |
| created_at / updated_at | TEXT NOT NULL | ISO 时间 |

#### character_settings — 结构化设定（一卡一条）

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7 |
| profile_id | TEXT NOT NULL UNIQUE | 一卡恰好一条 |
| character_name … image_constraints | TEXT NOT NULL DEFAULT '' | 33 个字符串字段（清单见第 3.2.5 节），各 ≤4000 字 |
| values | —— | 注意：`values` 是 SQL 关键字，库里列名叫 `values_text`，读写时映射回 `values` |
| custom_fields | TEXT NOT NULL DEFAULT '[]' | JSON 数组，`[{ key, value }]`；`key` 1–60 字、`value` ≤4000 字，最多 40 项 |
| updated_at | TEXT NOT NULL | ISO 时间 |

#### state_definitions — 状态定义（全局）

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7；种子 id 写死 |
| state_key | TEXT NOT NULL UNIQUE | `^[a-z0-9_]+$`，≤40 字 |
| name | TEXT NOT NULL | 1–40 字 |
| description | TEXT NOT NULL DEFAULT '' | ≤500 字 |
| required | INTEGER NOT NULL DEFAULT 0 | 是否必填；只有 base 为 1 |
| configurable | INTEGER NOT NULL DEFAULT 0 | 是否可配置；只有 base 为 1 |
| runtime_state_key | TEXT NULL | 有 Muse 运行时槽位时填运行时 key，否则 NULL |
| sort_order | INTEGER NOT NULL DEFAULT 0 | 画廊按此升序排列 |

#### state_links — 槽位链接（素材进槽位）

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7；前端叫它 `linkId` |
| profile_id | TEXT NOT NULL | 属于哪张卡 |
| state_key | TEXT NOT NULL | 属于哪个状态 |
| asset_id | TEXT NOT NULL | 链入的素材 |
| is_selected | INTEGER NOT NULL DEFAULT 0 | 该槽位是否选中此素材；每槽至多一个 1 |
| created_at | TEXT NOT NULL | ISO 时间 |
| UNIQUE(profile_id, state_key, asset_id) | —— | 同一素材进同一槽位只有一条链接 |

#### assets — 素材（正式素材与候选同一张表）

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7；同时是文件名（`<assetId>.<format>`） |
| profile_id | TEXT NOT NULL | 上传者那张卡；复制卡共享时行仍属原卡 |
| media_type | TEXT NOT NULL | `image` / `video`（类型上还有 `animation`，本地上传只产生前两种） |
| format | TEXT NOT NULL | `png` / `jpg` / `webp` / `gif` / `mp4` / `webm` |
| file_path | TEXT NOT NULL | 形如 `assets/<profileId>/<assetId>.<ext>`（相对 `server/data/`） |
| thumbnail_path | TEXT NULL | 本地恒为 null（不生成缩略图）；线上会生成 |
| width / height | INTEGER NULL | PNG/GIF/WebP 尽量解析，解析不到为 null |
| file_size | INTEGER NULL | 字节数 |
| sha256 | TEXT NULL | 上传时算的 SHA-256 hex |
| source | TEXT NOT NULL DEFAULT 'upload' | `upload` / `generated` / `imported` |
| prompt | TEXT NULL | 生成提示词；本地生成失败不产生候选行，故本地恒为 null |
| note | TEXT NULL | 备注，≤500 字；`importRuntimeBase` 会写 MD5 备注 |
| status | TEXT NOT NULL DEFAULT 'asset' | `'asset'`（正式）或 `'candidate'`（候选）；候选采纳后改回 `'asset'` |
| state_key | TEXT NULL | 上传/生成时的目标状态（仅作记录，不等于槽位链接） |
| created_at | TEXT NOT NULL | ISO 时间 |

索引：`idx_assets_profile (profile_id)`、`idx_links_profile (profile_id, state_key)`、
`idx_activations_profile (profile_id, activated_at)`。

#### generation_jobs — 生成任务

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7 |
| profile_id | TEXT NOT NULL | 哪张卡 |
| state_key | TEXT NOT NULL | 目标状态 |
| status | TEXT NOT NULL | `error`（本地生成失败时记的唯一状态；线上成功时还会有其他状态，前端 `jobs` 只取 `id/stateKey/status/createdAt`） |
| error | TEXT NULL | 失败原因全文（本地是 `[MUSE_DEPENDENT]` 报错文本） |
| created_at | TEXT NOT NULL | ISO 时间 |

#### activations — 激活历史

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7 |
| profile_id | TEXT NOT NULL | 激活了哪张卡 |
| activated_at | TEXT NOT NULL | ISO 时间 |
| provider_status | TEXT NOT NULL DEFAULT 'local_record' | 恒为 `'local_record'`：只写了本地记录，没调任何 Muse 接口 |
| snapshot_json | TEXT NOT NULL | JSON 字符串快照：`mode`、`baseAssetId`、`baseAssetSha256`、`stateSelections`（全部 10 个槽位）、`settingsText`、可选 `note` |

#### active_profile — 当前激活（全局单行）

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| scope | TEXT PK | 恒为 `'global'` |
| profile_id | TEXT NULL | 当前激活卡的 id；解除激活时整行删除 |

#### asset_references — 参考标记

| 列 | 类型 | 约束 / 说明 |
| --- | --- | --- |
| id | TEXT PK | UUIDv7 |
| profile_id | TEXT NOT NULL | 哪张卡的参考 |
| asset_id | TEXT NOT NULL | 标记的素材 |
| kind | TEXT NOT NULL | `'appearance'`（外观）或 `'style'`（画风） |
| created_at | TEXT NOT NULL | ISO 时间 |
| UNIQUE(profile_id, asset_id, kind) | —— | 同一素材同一 kind 只有一条标记 |

### 5.4 派生字段（不在表里，返回时算出来）

| 字段 | 在哪 | 怎么算 |
| --- | --- | --- |
| `coverUrl` | `CharacterProfile` | 有 `cover_asset_id` 且素材存在时为 `/assets/<profileId>/<assetId>.<format>`，否则 `null`；前端再回退到 `/assets/runtime/base.webp` |
| `progress.configured` | `CharacterProfile.progress` | 可配置槽位（只有 base）中有选中的个数，0 或 1 |
| `progress.total` | `CharacterProfile.progress` | 可配置槽位的总数，恒为 1；所以卡片进度只会是 0/1 或 1/1 |
| `assetCount` | `getStudio` 的 profile | 本卡拥有或已链入画廊的去重素材数（复制卡共享原卡素材时也计入） |
| `configuredStates` / `totalStates` | 同上 | 与 `progress` 同义的两份字段 |
| `isActive` | `CharacterProfile` / `ProfileDetail` | `active_profile` 指向该卡时为 true |
| `settingsText` | `ProfileDetail` | 服务端按第 3.3.3 节规则拼接的整合文本；空字段不列出 |
| `galleryId` | `CharacterProfile` | 本地恒为 `null`——没有独立的 gallery 表，工作台技术信息里显示 `—` |
| `SlotAsset.linkId` / `isSelected` | `StateSlot.assets[]` | 由 `state_links` 行派生 |
| `Asset.url` | `Asset` | `/assets/<profileId>/<assetId>.<format>`，由后端拼出 |
| `Asset.note` | `Asset` | 数据库 `note` 列；`importRuntimeBase` 会写 MD5 备注 |

### 5.5 种子数据 A/B（`server/src/seed.ts`，按线上实测原样）

两张卡 `createdAt` 均为 `2026-11-26T09:55:34.819Z`，`cover_asset_id` 均为 null
（封面回退到运行时原图）。

**A 卡 — 黑岩射手 · 原作人格**

- id：`01a21748-2923-7000-b4c7-8fae8e6bc980`；settings id：`01a21748-2923-7002-a171-16f93b2ebecd`
- 简介：原作人格：冷淡、寡言、战斗风格。标签：原作、战斗。`favorite: true`
- 设定（只列非空项，其余字段为空串，`customFields` 只有 1 项）：
  `characterName` 黑岩射手；`identity` 原作角色 · 战斗形态；`origin` 原作角色；
  `relationship` 亲密伙伴；`personality` 冷淡、寡言、外冷内热；`temperament` 平静、克制；
  `speakingStyle` 简短直接，情绪表达克制；`tone` 平静；
  `responseStyle` 简短，不主动夸张表达情绪，偶尔表现出细微的关心；
  `forbiddenBehaviors` 不刻意卖萌；不夸张表达情绪；`appearance` 原作外观；
  `hair` 黑色长发；`eyes` 眼中燃着蓝色火焰；`outfit` 原作战斗服装；
  `colorPalette` 黑、白、蓝；`visualStyle` 战斗风格；
  `consistencyRules` 保持黑色长发与蓝色火焰眼；不更改角色年龄感；
  `customFields`：`[{ key: '标志特征', value: '蓝色火焰' }]`

**B 卡 — 黑岩射手 · 日常人格**

- id：`01a21748-2923-7001-8d21-3bc699c4c9f9`；settings id：`01a21748-2923-7003-a5eb-3cbceffa7fa7`
- 简介：日常人格：温柔、安静、更亲近。标签：日常、柔和。`favorite: false`
- 设定（只列非空项，`customFields` 为空）：
  `characterName` 黑岩射手；`identity` 日常人格；`origin` 原作角色；
  `relationship` 更亲近的伙伴；`personality` 温柔、安静；`temperament` 柔和、平和；
  `speakingStyle` 轻声、简短而温和；`tone` 温柔；`responseStyle` 安静亲近，不过分热闹；
  `appearance` 日常形象；`hair` 黑色长发；`eyes` 柔和的蓝色眼睛；`outfit` 日常服装；
  `colorPalette` 柔和色调；`visualStyle` 柔和画风；
  `consistencyRules` 保持角色辨识度与黑色长发

两张卡的 `settingsText`（整合文本）格式见第 3.3.3 节；种子数据下与线上逐字一致（已实测比对）。

### 5.6 10 条状态定义（`seed.ts` 的 `SEED_STATE_DEFS`，按 `sort_order` 升序）

| sort_order | stateKey | 名称 | configurable | required | runtimeStateKey | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | base | 基础形象 | 是 | 是 | null | Muse 的单一基础形象，全部动画状态由它派生。这是 shared_base 模式下唯一可同步到 Muse 的槽位 |
| 1 | idle | 待机 | 否 | 否 | idle | 无交互时的静止状态。Muse 运行时由基础形象自动生成，工作室可另存素材备用 |
| 2 | waking | 唤醒 | 否 | 否 | waking | Muse 被唤醒时的过渡状态，运行时自动生成 |
| 3 | listening | 聆听 | 否 | 否 | null | 聆听用户说话的状态（工作室状态，Muse 当前无独立运行时槽位） |
| 4 | thinking | 思考 | 否 | 否 | null | 思考与推理中的状态（工作室状态，Muse 当前无独立运行时槽位） |
| 5 | speaking | 说话 | 否 | 否 | null | 回复用户时的状态（工作室状态，Muse 当前无独立运行时槽位） |
| 6 | working | 工作 | 否 | 否 | working | 执行任务时的状态。Muse 运行时由基础形象自动生成 |
| 7 | generating | 生成 | 否 | 否 | making_something | 生成内容时的状态，对应运行时的“制作中”动画 |
| 8 | happy | 愉悦 | 否 | 否 | milestone_level_up | 完成里程碑时的愉悦状态，对应运行时的“里程碑”动画 |
| 9 | error | 错误 | 否 | 否 | null | 出错时的状态（工作室状态，Muse 当前无独立运行时槽位） |

完成度分母只计 `configurable` 的槽位，所以是 x/1，不是 x/10。
`runtimeStateKey` 非空的 5 个（idle、waking、working、generating、happy）对应 Muse 的
5 个运行时状态；为 null 的 4 个（listening、thinking、speaking、error）不是 Muse 独立槽位，
画廊里不得把它们伪装成 Muse 当前形象。

---

## 六、状态机 / 生命周期

### 6.1 角色卡

```text
新建（createProfile，带空设定）
  │  （未激活）
  ├─→ 激活（activateProfile：base 有选中素材、未归档）
  │     当前激活（active_profile 指向它；Hero 显示“已激活”，激活按钮禁用）
  │       ├─→ 解除激活（deactivateProfile：只清 active_profile 一行，历史保留）
  │       └─→ 归档 / 删除：被阻止（须先解除激活）
  ├─→ 归档（archiveProfile：archivedAt 置时间；激活中禁止）
  │     已归档 ──→ 恢复（restoreProfile：archivedAt 清空）──→ 未激活
  │     已归档 ──→ 激活：被阻止（须先恢复）
  └─→ 删除（deleteProfile：激活中禁止；连带删设定、链接、任务、激活记录、参考与素材）
```

注意：归档没有独立的列表界面，归档后卡仍在角色库主列表里出现（见第 3.2.1 节）；
“已归档”只体现在 `archivedAt` 非空，以及激活会被拒绝。

### 6.2 素材

```text
上传（uploadAsset，status='asset'）
  │  未链入任何槽位：只在素材库里（getProfileDetail 的 assets 列表）
  ├─→ 链入槽位（linkAssetToState / 上传时 select / selectStateAsset 自动链入）
  │     已链入 ──→ 选中（selectStateAsset：同槽唯一选中）
  │     已链入 ──→ 移除链入（unlinkStateAsset：素材保留在库里）
  ├─→ 设为封面（setCover：只影响展示；传 null 清除）
  ├─→ 设为参考（setReference：appearance / style；同一素材两种 kind 可并存）
  └─→ 删除（deleteAsset：被选中时禁止；删文件、全部链接与参考标记；无回收站）
```

### 6.3 候选（生成产物）

```text
生成请求（generateAsset）
  ├─ 线上：调 generate_media 成功 → 新建 assets 行，status='candidate'
  │     候选 ──→ 采纳（adoptCandidate：status 改为 'asset'，链入指定槽位，默认选中）
  │     候选 ──→ 丢弃（discardCandidate：删文件、删链接、删行）
  └─ 本地：记一条 status='error' 的任务，然后返回 [MUSE_DEPENDENT] 报错，不产生候选行
```

候选与正式素材的唯一区别就是 `assets.status` 这一列；候选不可被选中、不可链入、
不可设封面、不可做参考，必须先采纳。

### 6.4 激活记录

一次激活（`activateProfile`）写两样东西，缺一不可：

1. `activations` 表新增一行：`{ id, profileId, activatedAt, providerStatus:'local_record', snapshot_json }`，
   快照含 `mode:'shared_base'`、`baseAssetId`、`baseAssetSha256`、全部 10 个槽位的
   `stateSelections`、`settingsText`、可选 `note`。
2. `active_profile` 表 upsert 一行：`scope='global'` → 该卡 id（全局只有当前这一张卡是激活的，
   激活 B 卡会自动顶掉 A 卡的激活状态，不保留“上一个激活”）。

激活历史只增不改：重复激活同一张卡会追加新的激活记录，旧记录保留；
解除激活不删除历史；删除角色卡会连带删除它的全部激活记录。

### 6.5 状态定义

```text
内置 10 条（seed，见第 5.6 节）
  │  不可删除、不可改 stateKey / configurable / runtimeStateKey；
  │  updateStateDefinition 可改名字、描述、必填、排序
  └─→ 自定义定义（addStateDefinition）
        新定义固定 required=false、configurable=false、runtimeStateKey=null
        可改名/改描述/改必填/改排序（updateStateDefinition）
        可删除（deleteStateDefinition，连带删掉该状态的全部槽位链接）
```

---

## 七、关键流程

### 7.1 首开种子

1. 浏览器打开 `http://localhost:5173`，`main.tsx` 挂载 `App`。
2. `App` 调 `getStudio`，本地后端查 `character_profiles`（空库返回 `[]`）。
3. `App` 见 `profiles.length === 0`，自动调 `seedStudio`。
4. 后端 `insertSeedData`：`INSERT OR IGNORE` 写 10 条状态定义与 A/B 两张卡及设定；
   再调一次 `getStudio` 即返回两张卡。已有任意卡时 `seedStudio` 为 no-op。
5. 也可以不经过前端，直接 `curl POST /actions {"action":"seedStudio","input":{}}`。

### 7.2 创建角色

1. 角色库点“+ 新建角色卡” → `createProfile({ name:'黑岩射手', subtitle:'新角色', description:'' })`。
2. 后端建 profile 行 + 一条 33 字段的 settings 行（除 `characterName` 预填为传入的 name 外全空），
   返回 profile；前端 toast“已创建新角色卡”，直接进该卡的工作台。
3. 新卡的画廊 10 个槽位全空、未激活、未收藏；设定 Tab 显示空表单（点保存才会写入）。

### 7.3 写设定（7 组 + 整合预览 + 草稿持久化）

1. 工作台 → 角色设定 Tab → `SettingsForm` 读 `getProfileDetail` 的 `settings` 作初始值。
2. 改任意字段 → `useDraft('settings', profileId, {})` 只记改动（patch），同步写 localStorage
   （键 `mcs-draft:settings:<profileId>`）；切 Tab、切卡、刷新都恢复。
3. 点“查看整合预览” → 读服务端上次保存后生成的 `settingsText`（只读 Modal），
   不是当前草稿的实时预览。
4. 点“保存设定” → 发 `{ profileId, patch }` 给 `saveSettings`，后端合并后全量写回，
   返回 `{ settings, settingsText }`；前端 toast“设定已保存”，并在点按当时清除草稿。
   失败时 toast“保存失败：…”（草稿已被清掉，见附录 A.4）。
5. 自定义字段：点“+ 增加自定义字段”（上限 40 项），每项填字段名与内容，可逐项删除；
   与 33 个固定字段一起随 patch 保存。

### 7.4 生成与采纳

1. 工作台 → 生成中心 Tab → 选目标状态（全部状态定义都可选）、写状态描述（≤1000 字）与
   补充要求（≤1000 字）；简述草稿键含目标状态，换状态即换一份草稿。
2. 点“开始生成” → `generateAsset`。**线上**：服务端拼提示词（外观、发色、眼睛、服装、
   配色、视觉风格、一致性规则、人格 + base/negative 提示词 + 状态简述与补充要求），
   调 `generate_media` 生成方形图，产物进候选区。**本地**：记一条 error 任务后返回
   `[MUSE_DEPENDENT]` 报错，不产生候选。
3. 候选区点“采纳进画廊” → `adoptCandidate({ profileId, candidateId, stateKey })`，
   候选行转正并链入该槽位（默认选中），旧选中素材不被删除，只被取消选中。
4. 点“丢弃” → `discardCandidate`，删文件、删链接、删候选行。

### 7.5 上传与导入

**上传（uploadAsset）：**

1. 画廊 base 卡点“上传”（或参考素材 Tab 点“上传素材”，两者共用同一个隐藏 input，
   都走 `stateKey:'base'`）。
2. 选文件 → 前端把 File 转 `{ dataBase64, mimeType }` → `POST /actions`。
3. 后端校验类型（6 种）与大小（base64 ≤28,000,000 字符）、算 SHA-256、解析宽高、
   原子 rename 写文件、建 assets 行；`select` 时同时链入并选中指定槽位。

**一键导入运行时原图（importRuntimeBase，本地别名）：**

1. 后端按顺序找 `client/src/assets/runtime/base.webp`，再找 `server/data/runtime-base.webp`。
2. 都没有 → 报 `[MUSE_DEPENDENT]`，错误里提示已知副本位置
   （`~/workspace/reverse-test/v1-exact.webp`，MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`）。
3. 找到 → 算 SHA-256 与 MD5，MD5 与已验证原图不一致时在 `warning` 里提示；
   以 `source='imported'` 存入并自动选入 base 槽位，备注写 MD5；
   同一卡已导入过同一 SHA-256 时返回已有素材（`alreadyPresent:true`）。
4. 线上没有这个动作，线上对应流程是系统页“导入为基础形象”→ `uploadAsset source='imported'`。

### 7.6 激活与切换

1. 工作台 Hero 点“激活此角色” → `activateProfile`。
2. 后端校验：卡已归档 → 拒绝；base 槽位无选中素材 → 拒绝（须先上传或选择一张基础形象素材）。
3. 通过后写激活记录 + 快照，并把 `active_profile` 指向该卡；前端 toast“角色已激活”，
   Hero 显示“已激活 · 本地记录”，激活按钮禁用。
4. 切换：直接进另一张卡点激活即可，`active_profile` 会被顶掉；旧卡的激活历史保留。
5. 解除激活只能直接调 `deactivateProfile`（前端无入口）；归档/删除已激活的卡会被后端拒绝。

### 7.7 导出与导入

1. 直接调 `exportProfile({ profileId })` → 得到 `{ json }`（单个 JSON 字符串，
   格式 `muse-character-studio/profile@1`），可保存为文件；素材字节不在里面，
   只有 id 与 sha256 供核对。
2. 直接调 `importProfile({ json })` → 只恢复 profile + settings；
   导出里列出的状态定义缺失时按 stateKey 补建；画廊与素材文件不恢复；
   profile id 冲突时换新 id；`format` 不符时拒绝。
3. 前端目前没有导出/导入的入口按钮（见第 3.5 节）。

---

## 八、能力边界与 Muse 依赖

### 8.1 shared_base 能力矩阵（`getCapabilities` 实测，2026-11-26）

| 能力 | 值 | 说明 |
| --- | --- | --- |
| mode | `shared_base` | 单一基础形象模式；不是 `independent_state` |
| avatarSupported | true | 头像支持 |
| candidateActivation | true | 候选激活支持（候选 ID 是一次性凭证） |
| staticImage | true | 静态图片支持 |
| videoVariants | true | 视频变体支持（系统生成） |
| independentStateAssets | **false** | **没有独立状态素材**：除 base 外的状态不能各配各的素材 |
| sharedBaseAvatar | true | 只有一个基础形象槽位可同步 |
| candidateIdReusable | **false** | 候选 ID 不可复用：任一候选被激活后，同批全部候选（含已激活者）立即失效 |
| darkModeVariants | true | 深色变体支持（前端靠 `prefers-color-scheme` 切换） |
| availableStates | 5 个 | `idle`、`waking`、`working`、`making_something`、`milestone_level_up`（Muse 运行时状态） |

矩阵还含 4 条 `notes`（候选 ID 一次性、Asset ID 永久身份、shared_base 说明、
本地激活说明）、`runtimeAvatar`（v1 原图，MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`，
1600×1600，`workspace/avatars/avatar-1795685697554236405-6.webp`）与
`runtimeStates` 5 条（待机 / 唤醒 / 工作中 / 制作中 / 里程碑，均为“静态帧 + 视频变体（系统生成）”）。

### 8.2 四项 Muse 依赖功能（本地表现与替代做法）

| 功能 | 本地表现 | 为什么 | 替代做法 |
| --- | --- | --- | --- |
| 生成图片 `generateAsset` | 报错 `[MUSE_DEPENDENT]`，不产生假图；失败记一条 `status='error'` 的任务，可在生成中心的技术信息里看到任务数 | 需要 Muse 的 `generate_media`，本地调不到 | 在线上工作室生成候选；或用 `uploadAsset` 上传真实图片 |
| 读取 Muse 运行时形象 `getRuntimeAssets` | 返回 `{ baseImageUrl: null, baseSha256: null, stateFrames: {}, warning }`，不编造运行时帧 | 本地够不到 Muse 运行时 | 看线上工作室 `getCapabilities` 的 `runtimeAvatar`（MD5 `2fb6…`） |
| 清除 Muse 头像 `clearAvatar` | 报错 `[MUSE_DEPENDENT]`，本地资产不受影响 | 需要访问 Muse 运行时头像 | 在 Muse 本人处清除头像；工作室的本地素材不受影响 |
| 一键导入运行时原图 `importRuntimeBase` | 本地没有 base.webp 时报错 `[MUSE_DEPENDENT]`，并提示已知副本位置 | 本地仓库不存 164690 字节大图 | 把原图复制到 `server/data/runtime-base.webp` 后重试；或在线上工作室用系统页导入。已验证：放图后导入成功，1600×1600、SHA-256 与原文件一致，第二次调用返回同一素材（`alreadyPresent`） |

补充说明：

- `generateAsset` 的报错由 `server/src/muse.ts` 的 `MuseDependentError` 集中产生，
  错误文本以 `[MUSE_DEPENDENT]` 开头，机器可读 code 同名；前端 `GeneratePanel`
  的 mutation 没有 `onError` toast，失败时界面上只有“生成中…”恢复、候选区无新增，
  需结合任务记录确认——这是“不伪造”的实现方式，不是静默成功。
- `getRuntimeAssets` 与 `clearAvatar` 在**线上也不发布**（实测不存在），是本地别名；
  `generateAsset` 线上真实存在，本地只是跑不通。
- 激活（`activateProfile`）**不依赖 Muse**：它只写本地记录与快照，从不调
  `avatar.set`、不改运行时头像、不改长期记忆。把形象真正同步到 Muse 头像，
  只能由 Muse 本人通过候选流程完成（原图恢复用换文件法，见 `AGENTS.md` 的验证记录）。

### 8.3 明确没有的功能（不是“还没写”，是设计上就没有）

- 独立状态素材（`independent_state`）：每个状态各配各的素材。能力矩阵
  `independentStateAssets=false`；画廊组件里有按同一分支预留的文案，
  但分支不启用。不要把它当成功能用，也不要为它写测试。
- 候选 ID 复用 / 版本切换：候选 ID 一次性，激活后整批失效；不要保存候选 ID
  指望以后切换版本（2026-11-26 已多次实测为 `stale`）。
- 素材版本管理：没有版本号，同一状态多素材时只有一个选中，采纳不覆盖旧素材。
- 缩略图生成（本地）：`thumbnailPath` 恒为 null，前端用原图 URL 预览。
- 回收站 / 30 天恢复：删除是永久删除，没有回收站（见附录 A.3）。
- 本地与线上数据同步：两者不互通，种子 id 相同但内容各自独立；改本地不会动线上。
- 多人协作、账号登录、鉴权：本地后端无鉴权，单机开发用；不要暴露到公网。

---

## 九、文件索引

> 每个文件/目录一句话说明。路径以仓库根目录为准；标 `（不提交）` 的不在 Git 里。

| 路径 | 说明 |
| --- | --- |
| `docs/DESIGN.md` | 本文件：完整设计文档（产品定位、模块、功能点、数据模型、流程、能力边界） |
| `README.md` | 项目总入口：启动方式、设计系统摘要、验收清单、后端一节；顶部有指向本文档的入口 |
| `package.json` | 包定义与脚本：`dev` / `dev:server` / `dev:full` / `build` / `typecheck` / `preview` / `lint:css`；`private:true` |
| `bun.lock` | 依赖锁文件，`bun install` 生成；改依赖后会变，需一起提交 |
| `vite.config.ts` | Vite 配置：端口 5173、React 与 Tailwind 插件、`/actions` 与 `/assets` 代理到 8787 |
| `index.html` | 前端 HTML 入口：`lang="zh-CN"`、viewport、`<div id="root">`、加载 `client/src/main.tsx` |
| `.gitignore` | 忽略 `node_modules/`、`dist/`、`.env`、`server/data/`（数据库与素材不提交） |
| `tsconfig.json` | 前端 TS 配置（严格模式，`include` 为 `client/src` 与 `vite.config.ts`） |
| `tsconfig.node.json` | 仅 `vite.config.ts` 的 TS 配置 |
| `client/src/main.tsx` | 前端启动：建 QueryClient（`staleTime` 30 秒、失败重试 1 次）、挂载 `App`、加载 `theme.css` |
| `client/src/App.tsx` | 三视图与角色库、系统页；首开自动种入；toast 与导航 |
| `client/src/Workspace.tsx` | 角色工作台：Hero、四 Tab、上传、归档/删除、技术信息折叠区 |
| `client/src/api.ts` | 动作类型契约 + `POST ./actions` 的 fetch 封装 + File→base64 传输转换；9 个 `[LOCAL ALIAS]` 别名在此标注 |
| `client/src/shared.ts` | 前后端共用的领域类型、能力常量、运行时原图常量（MD5、字节数、尺寸） |
| `client/src/theme.css` | 全部设计 token：颜色、字体、圆角、阴影、按钮、徽标、暗色模式、390px 标题修复 |
| `client/src/hooks/useDraft.ts` | 草稿持久化 hook（`useDraft` 与未被调用的 `useDebouncedDraft`） |
| `client/src/components/ui.tsx` | 基础组件：Button、StatusMark、Badge、EmptyState、Modal（Radix Dialog） |
| `client/src/components/ProfileCard.tsx` | 角色库卡片：封面优先、进度条、收藏星标 |
| `client/src/components/Hero.tsx` | 工作台主视觉：封面、名称、简介、激活/编辑资料按钮 |
| `client/src/components/GalleryCard.tsx` | 单状态画廊卡：图片主体、可配置/自动驱动、双图对照 |
| `client/src/components/SettingsForm.tsx` | 7 组结构化设定编辑器 + 自定义字段 + 整合预览 |
| `client/src/components/GeneratePanel.tsx` | 生成表单与候选列表（采纳/丢弃） |
| `client/src/components/PreviewDialog.tsx` | 高清预览对话框（`object-contain`，最大高度 70vh） |
| `client/src/components/ConfirmDialog.tsx` | 危险操作确认框（归档/删除/删素材共用） |
| `client/src/assets/runtime/README.md` | 运行时原图 `base.webp` 的说明（来源、尺寸、MD5）；目录里没有大图文件本身 |
| `server/BACKEND.md` | 本地后端说明：30 个真实动作清单、与线上差异、警告表、启动与重置、自查结果 |
| `server/dev-full.ts` | `bun run dev:full` 启动器：同时起后端 8787 与前端 5173 |
| `server/tsconfig.server.json` | 服务端 TS 配置（`types: ["bun-types"]`，`include` 为 `src` 与 `dev-full.ts`） |
| `server/src/CONTRACT.md` | 后端契约总览：文件分工、关键契约、shared_base 边界 |
| `server/src/schema.ts` | 数据模型：9 张表建表、行记录映射、`settingsText` 拼接 |
| `server/src/seed.ts` | 种子数据：A/B 卡与 10 条状态定义（id 与文案按线上实测写死） |
| `server/src/actions.ts` | 30 个真实动作 + 9 个本地别名 + 分发表 + 全部守则（1155 行） |
| `server/src/http.ts` | Bun 服务入口：8787，`GET /health`、`POST /actions`、`GET /assets/` |
| `server/src/muse.ts` | Muse 依赖隔离层：四项功能的报错 / warning / 本地原图查找 |
| `server/data/`（不提交） | 本地运行时数据：`studio.db`（SQLite）、`studio.db-wal` / `-shm`、`assets/<profileId>/`（素材文件）、可选的 `runtime-base.webp`（手动放置的原图）；删掉整个目录即重置回首开状态 |
| `node_modules/`（不提交） | 依赖安装目录，`bun install` 生成 |
| `dist/`（不提交） | `vite build` 产物，用完即删，不提交 |

---

## 十、术语表、验收清单与已知未验证项

### 10.1 术语表

| 术语 | 含义 |
| --- | --- |
| profile / 角色卡 | 一个完整的 Muse 形象与人格配置单位；身份是 `profileId`，不是名字；同名卡互不干扰 |
| Asset / 素材 | `assets` 表的一行 + `server/data/assets/` 下的一个文件；有永久 id、SHA-256、来源（upload / generated / imported） |
| candidate / 候选 | `status='candidate'` 的素材行；生成产物先是候选，采纳后才成为正式素材；候选不可选中、不可链入 |
| slot / 槽位 | 一个状态定义在某张卡上的位置（`state_links` 的集合）；每槽至多选中一个素材 |
| state definition / 状态定义 | 全局的状态条目（base、idle、waking、listening、thinking、speaking、working、generating、happy、error，及自定义）；只有 base 可配置 |
| activation / 激活 | `activateProfile` 写下的记录 + 快照；`providerStatus` 恒为 `'local_record'`，只代表“本地选了这张卡”，不代表 Muse 头像已同步 |
| cover / 封面 | `cover_asset_id` 指向的展示用图（角色库卡片与 Hero 用）；不是 Muse 头像 |
| reference / 参考素材 | `asset_references` 的标记（`appearance` 外观 / `style` 画风）；生成时作为参考注入（线上语义；本地生成跑不通） |
| shared_base | 唯一真实模式：只有一个基础形象槽位可同步，其余状态由 Muse 运行时自动派生 |
| independent_state | 预留但不启用的模式：每个状态独立配素材；能力矩阵 `independentStateAssets=false` |
| settingsText / 整合文本 | 服务端按 33 个设定字段拼出的文本；是最终传递给 Muse 的设定文本，也是激活快照的一部分 |
| seed / 种子 | 首开自动种入的 A/B 两张卡与 10 条状态定义；已有任意卡时 `seedStudio` 为 no-op |
| [LOCAL ALIAS] / 本地别名 | `api.ts` 里线上不发布的 9 个动作（selectAsset、deleteCandidate、getSettingsText、importRuntimeBase、listActivations、getRuntimeAssets、verifyAssetIntegrity、clearAvatar、listGenerationJobs），只为本地前端兼容而存在 |
| MUSE_DEPENDENT | 依托 Muse 的功能在本地无法运行时的错误 code；见 `server/src/muse.ts` |

### 10.2 验收清单（与 `README.md` 第十节一致，照单核对）

- [ ] 角色库：封面为图（非单字占位），同名 A/B 卡可区分，收藏切换正常，进度条与数字一致。
- [ ] 工作台：Hero 有封面/名称/副标题/简介/激活/编辑，Tab 切换不丢设定草稿与生成简述草稿。
- [ ] 画廊：base 槽位显示当前选定素材；其余状态标注“自动驱动”，不要求手动配图；无双灰框并排。
- [ ] 设定：7 组齐全，行为规则独立成组，自定义字段可增删，整合预览可读，保存后草稿清除。
- [ ] 生成：候选与正式素材分离，采纳后才进画廊，不覆盖旧素材。
- [ ] 激活：成功有明确反馈，失败不覆盖原激活记录；激活不改运行时头像（以本地记录为准）。
- [ ] 危险操作：归档/删除/删素材均有确认框；已激活引用素材不可删。
- [ ] 响应式：1280px 桌面、768px 平板、390px 手机下标题不截断、无横向溢出、无控制台报错。
- [ ] 上传/导入：B 卡上传小图能进素材库；系统页“导入为基础形象”按 MD5 核对。
- [ ] 本地后端：`bun run dev:full` 启动后角色库加载出 A/B 两张卡；`GET /health` 返回 ok；
  `generateAsset` 明确报 `[MUSE_DEPENDENT]`；`getRuntimeAssets` 返回 warning 空结果。

### 10.3 已知未验证项（写文档时就知道没验过，不要当成已完成）

- 浏览器里人工点按前端全流程（上传、生成、激活、导入）未做——后端接口均已实测
  （45 项动作检查 + 17 项补测，见 `server/BACKEND.md` 第七节），前端在浏览器里的
  点按仍待用户验收。
- 390px 真机复测未做：标题换行只做了代码级修复并在模拟视口验证，未在真机复测。
- `settingsText` 对种子里为空的 16 个字段非空时是否列出、用什么标签列出，
  无法在不改线上数据的前提下验证；本地按分组补列（见第 3.3.3 节）。
- `updateProfile` 未传字段保留原值、`deleteStateDefinition` 只允许删自定义定义，
  这两处与线上 schema 字面含义不同，已在 `server/BACKEND.md` 第三节标注。
- 版本锁定未决定：`package.json` 用 `^` 范围，实际解析到 React 19.3.1、Tailwind 4.3.5、
  react-query 5.108.4、zod 4.6.7、TypeScript 5.9.3、Vite 7.3.8；是否精确锁定基线版本
  （React 19.2.5 / Tailwind 4.1.13 / react-query 5.100.10 / zod 4.4.3）仍待用户决定。

---

## 附录 A：写本文档时核对发现的代码与旧文档不一致处

> 这些不是本文档的笔误，是通读源码后发现的、旧文档（`README.md` / `server/BACKEND.md` /
> 代码注释）与代码实际行为不符的地方。列在这里，供后续修代码或修文档时逐项处理；
> 本文档正文一律以代码为准。

- **A.1 设定字段数是 33 个，不是 32 个。** `server/src/schema.ts` 的 `SETTINGS_FIELDS`
  实际有 33 项（见第 3.2.5 节的完整清单）；`README.md`、`server/BACKEND.md`、
  `client/src/api.ts` 注释里写的“32 个字段”与代码不符。本文档写 33 个。
- **A.2 base 卡的“替换”按钮目前是空操作。** `GalleryCard` 的“替换”按钮调
  `Workspace` 传的 `onCompare={() => undefined}`；真正的替换做法是上传/生成新素材后
  点缩略图条切换选中。
- **A.3 没有回收站。** 参考素材删除确认框写“删除后可在回收站恢复（30 天）”，
  但 `deleteAsset` 是永久删除（删文件、删链接、删参考标记），代码里没有任何回收站逻辑。
- **A.4 草稿在点保存当时就清掉，不是“保存成功后才清”。** `SettingsForm` 是
  `onSave(draft.value); draft.clear()`（同步执行），`GeneratePanel` 点“开始生成”时也
  立即 `brief.clear()`；保存失败时草稿已清。`README.md` 第六节“只在保存成功后清除”
  与代码不符。
- **A.5 系统页“生成缩略图”与本地不符。** `App.tsx` 的 `SystemView` 写“保存时算
  SHA-256、生成缩略图、原子 rename”，但本地后端不生成缩略图（`thumbnailPath` 恒为 null）。
- **A.6 已归档的卡仍会出现在角色库。** 后端 `getStudio` 与前端列表都没有过滤
  `archivedAt`；`restoreProfile` 存在但前端无入口。
- **A.7 五个运行时状态共用同一张占位图。** `Workspace.tsx` 的 `runtimeFrames`
  把 idle、waking、working、making_something、milestone_level_up 五个状态
  都指向 `/assets/runtime/base.webp`；画廊里看到的“运行时帧”目前是同一张 base 图，
  不是五个不同的帧。本地 `getRuntimeAssets` 返回空结果与此一致，不要误读为“五个帧都有”。
- **A.8 `galleryId` 恒为 null。** 没有独立的 gallery 表，`profileRowToDomain`
  写死 `galleryId: null`；工作台技术信息里显示 `—`。
- **A.9 `useDebouncedDraft` 没有任何调用方。** 导出在 `hooks/useDraft.ts` 里，
  全仓库无人调用，是预留代码。
- **A.10 系统页不用 `getCapabilities`。** `SystemView` 展示的是前端写死的
  `AUDITED_CAPABILITIES`，`getStudio` 返回的能力矩阵前端也没用上；
  两份常量目前一致，但改一处时另一处不会自动跟着变。
