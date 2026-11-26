# Muse Character Studio — 前端重写（本地）

> 项目根目录：`~/workspace/projects/muse-character-studio/`
> 旧位置 `~/workspace/muse-character-studio/` 已整体移入此处，`~/workspace/` 根目录下不再留该文件夹。
> 本轮只重写前端，**不要动线上 artifact（space:muse-character-studio）**，线上应用前须经用户确认。

## 一、这是什么

Premium Creative Studio 风格的 Muse 角色工作室前端重写：Apple 风格精致工具界面、
高品质数字艺术作品集、现代角色设计工作室；图片优先、内容优先，简洁、优雅、克制，
避免传统管理后台风格。

业务功能与数据模型基本保留，重点重构 UI、信息层次、布局与交互。

## 二、启动方式

```bash
cd ~/workspace/projects/muse-character-studio
bun install        # 已跑过：110 个包，23.16s（后端还原后新增 bun-types，见第十二节）
bun run dev:full   # 前端 5173 + 本地后端 8787 一起起，打开 http://localhost:5173
bun run dev        # 只起前端（没有后端，角色库会加载失败；不要单独这样跑）
bun run dev:server # 只起后端，http://localhost:8787/health
bun run typecheck  # 前端 tsc + 服务端 tsc（tsconfig.server.json）
bun run build      # tsc（前端+服务端）+ vite build
```

技术栈：React 19 + TypeScript + Tailwind CSS 4 + @tanstack/react-query 5 +
zod 4 + Radix Dialog/Slot（shadcn / Radix 风格手写封装，未引入 Ant Design / MUI）。

`package.json` 用 `^` 范围声明了用户给定的基线
（React 19.2.5、Tailwind 4.1.13、react-query 5.100.10、zod 4.4.3）；
2026-11-26 `bun install` 实际解析为兼容新版：React 19.3.1、Tailwind 4.3.5、
react-query 5.108.4、zod 4.6.7、TypeScript 5.9.3、Vite 7.3.8。
如需精确锁定基线版本，把 `^` 改为精确版本号后重新 `bun install`。

## 三、目录结构

```
~/workspace/projects/muse-character-studio/
├── package.json / bun.lock / vite.config.ts / tsconfig.json / index.html / .gitignore
├── README.md                     # 本文件
├── client/src/
│   ├── main.tsx                  # QueryClient + StrictMode 入口
│   ├── App.tsx                   # 三视图：角色库 / 工作台 / 系统设置；不 key 卸载 Workspace
│   ├── Workspace.tsx             # 工作台：Hero + 4 Tab + 技术信息折叠 + 危险操作确认
│   ├── api.ts                    # 30 个服务端动作的类型契约（见第六节）
│   ├── shared.ts                 # 领域类型、AUDITED_CAPABILITIES、RUNTIME_BASE_MD5
│   ├── theme.css                 # 完整设计 token（见第四节）
│   ├── hooks/useDraft.ts         # 草稿持久化（localStorage 镜像）
│   ├── components/
│   │   ├── ui.tsx                # Button / StatusMark / Badge / EmptyState / Modal（Radix Dialog）
│   │   ├── ProfileCard.tsx       # 角色库卡片：封面优先
│   │   ├── Hero.tsx              # 工作台主视觉
│   │   ├── GalleryCard.tsx       # 状态画廊卡片：图片主体
│   │   ├── SettingsForm.tsx      # 7 组结构化设定编辑器 + 整合预览
│   │   ├── GeneratePanel.tsx     # 生成中心：候选与正式素材分离
│   │   ├── PreviewDialog.tsx     # 高清预览
│   │   └── ConfirmDialog.tsx     # 危险操作确认
│   └── assets/runtime/README.md  # base.webp 说明（不复制大图）
└── server/src/CONTRACT.md        # 后端契约说明：本轮不动
```

线上 artifact 的旧前端只有 `App.tsx`（约 1000 行）、`Workspace.tsx`（约 1456 行）、
`api.ts`、`shared.ts`、`theme.css`、`main.tsx`，无 components/、无路由、无全局状态库。
本轮把 Workspace 拆为上述可复用组件，App 仍为三视图（library / workspace / system），
不引入路由库。

## 四、设计系统（theme.css）

设计定位：Premium Creative Studio。

| 维度 | 决策 |
|---|---|
| 背景 | 浅色 `#f2f3f5` / 卡片 `#ffffff` / 次级面 `#f7f8f9`；深色 `#0e1013` / `#171a1e`（`prefers-color-scheme`） |
| 字体 | 正文 Inter + 苹方/微软雅黑；标题 Songti SC / Noto Serif SC 衬线；字阶 12–32px，行高 1.4–1.65，中文可读优先 |
| 间距 | 页面 `max-w-[1280px]`（旧 `max-w-6xl` 已放宽），卡片内边距 16–20px，栅格 gap 20px |
| 圆角 | 8 / 12 / 16 / 20 / 24px；卡片 16px，按钮 12px，Hero 24px |
| 阴影 | sm / md / lg / hero 四档，克制使用 |
| 边框 | 1px `#e3e5e8`，悬停才加深；不做过度描边 |
| 按钮 | `.btn` 基类 + primary（墨色）/ accent（`#0b6bcb`）/ outline / ghost / danger 五种；文字 + 1px 边框，无胶囊堆叠 |
| 标签/徽标 | 状态用“圆点 + 文字”（`StatusMark`），徽标只用低饱和柔色底（`badge-soft/good/warn/accent`），不用大量胶囊标签 |
| 图片容器 | 封面 `aspect-[4/3] object-cover`，画廊 `aspect-[4/3]`，预览 `object-contain`，圆角与卡片一致 |
| 对比度 | 正文 `#17191c` / 次要 `#6b7078`，不用低对比度灰文；深色模式对应提高亮度 |

Tailwind v4 注意点（实测踩过）：`@apply` 不能引用自定义的 `.btn` / `.badge-soft`
类，构建会报 `Cannot apply unknown utility class 'btn'`。已改为：变体用纯 CSS
写颜色，`Button` 组件始终同时加 `.btn` 基类。见 `theme.css` 注释。

## 五、逐项落实（对照用户要求）

### 1. 角色库
- 卡片封面优先，`aspect-[4/3]` 大图；无封面时用内置运行时 base 图（v1 原图，
  MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`），**去掉单字“黑”占位**。
- 每卡：封面、名称、副标题、人格摘要（description 截断 2 行）、状态配置进度
  （`configured/total` + 进度条 + 百分比）、收藏状态；同名允许，ID 是身份。
- 主内容区 `max-w-[1280px]`，桌面 4 列。

### 2. 角色工作台
- 顶部 Hero：左主视觉、右名称/副标题/简介/激活/编辑资料；激活有明确反馈
  （成功提示 + 本地记录说明）。
- 下方导航：状态画廊 / 角色设定 / 生成中心 / 参考素材。
- 技术 ID、Settings/Gallery ID、选中素材 ID、激活历史等默认折叠在
  `<details>技术信息（默认隐藏）</details>` 里。

### 3. 状态画廊
- **去掉两个等大灰色占位框并排**。卡片以图片为主体，`aspect-[4/3]`。
- shared_base（已审计，唯一真实模式）：
  - `base` 槽位展示当前选定素材，支持查看素材集合、选择、上传、生成、替换。
  - 其余状态（idle/waking/working/making_something/milestone_level_up）展示
    Muse 实际运行时帧，标注“自动驱动 · Muse 运行时”，只读，不要求手动配图。
  - listening/thinking/speaking/error 的 runtimeStateKey 为 null，不得伪装成
    Muse 独立槽位。
  - 未配置的本地素材不伪装成 Muse 当前形象。
- independent_state：按同一组件分支预留——每个状态独立展示当前素材、支持
  素材集合/选择/上传/生成/替换、多候选不引入版本；当前能力矩阵为
  `independentStateAssets=false`，该分支不启用、不虚构。
- 双图对照只在用户点“对比本地素材”时出现。

### 4. 角色设定
- 7 组：基础身份（6 项）、人格性格（7 项）、交流风格（6 项）、外观设定（9 项）、
  **行为规则（新单列，forbiddenBehaviors 从交流风格移入）**、图片生成设定（4 项）、
  自定义补充（≤40 项）。
- 每字段 ≤4000 字，全量覆盖保存；有整合预览（只读 Modal），编辑不自动触发生成。

### 5. 交互
- 图片卡片点击高清预览（Radix Dialog，`PreviewDialog`）。
- 激活、保存、生成、采纳均有成功/失败提示（toast + 行内状态）。
- 生成候选与正式素材分离：`generateAsset` 产物 `status=candidate`，
  须 `adoptCandidate` 才进画廊，永不覆盖旧素材。
- 自动驱动 vs 可配置状态用徽标 + 文案区分明显。
- 归档/删除/删素材全部走 `ConfirmDialog`；已激活配置引用的素材不可删除，
  删除角色卡前须先解除激活。
- 响应式：桌面 1280px 宽布局，`sm` / `lg` / `xl` 断点，平板 2 列、手机 1 列。

### 6. 切 Tab 丢编辑 — 修复
旧问题：SettingsTab / GenerateTab 的表单 state 在组件内，切换 Tab 卸载即丢；
Workspace 用 `key={view.id}`，离开再返回也会重置。

修复（`hooks/useDraft.ts`）：
- 草稿提升到 Workspace 层概念 + `localStorage` 镜像，键为
  `mcs-draft:<scope>:<id>`（如 `mcs-draft:settings:<profileId>`、
  `mcs-draft:generate-brief:<profileId>:<stateKey>`）。
- 切换 Tab、切换角色卡、刷新页面都会恢复草稿；只在保存成功后清除。
- App 不再给 Workspace 加 key，Tab 切换不卸载页面级状态。

### 7. 390px 截断 — 修复
旧问题：390px 下“当前激活角色”卡标题“黑岩射手 · 原作人格”因 `truncate` 被截断 25px。

修复（`theme.css` + `Hero.tsx`）：
- 标题用 `.active-profile-title`：`overflow-wrap:anywhere; word-break:break-word;`
  允许换行，**全宽度禁用 truncate / whitespace-nowrap**。
- `≤430px` 时字号降为 15px；桌面端保持 28–30px 干净排版。
- 本轮未在真机复测 390px（见第九节待确认项），只做了代码级修复。

## 六、数据接口契约（api.ts，30 个动作）

`createActionClient<typeof Actions>()`，POST `./actions`，变更后 invalidate
`['studio']` 与 `['profile', id]`。动作清单以线上真实发布的 30 个为准
（请求 schema 见 `server/BACKEND.md`，类型见 `api.ts`）：

activateProfile、addStateDefinition、adoptCandidate、archiveProfile、
createProfile、deactivateProfile、deleteAsset、deleteProfile、
deleteStateDefinition、discardCandidate、duplicateProfile、exportProfile、
generateAsset、getCapabilities、getProfileDetail、getStudio、importProfile、
linkAssetToState、removeReference、restoreProfile、saveSettings、seedStudio、
selectStateAsset、setCover、setReference、toggleFavorite、unlinkStateAsset、
updateProfile、updateStateDefinition、uploadAsset。

另外 9 个是本地兼容别名，线上不发布（`api.ts` 里标了 `[LOCAL ALIAS]`）：
selectAsset（→selectStateAsset）、deleteCandidate（→discardCandidate）、
getSettingsText、listActivations、listGenerationJobs、importRuntimeBase、
getRuntimeAssets、verifyAssetIntegrity、clearAvatar。

> 注意：旧版 `api.ts` 列的动作清单与线上不一致（多出上面 9 个别名，
> 少了 add/update/deleteStateDefinition、link/unlinkStateAsset、setCover、
> setReference、removeReference；且 getRuntimeAssets 在线上实测是不存在的动作）。
> 后端还原时已按线上真实动作修正，差异见 `server/BACKEND.md`。

关键契约不变：
- `saveSettings`：32 个 ≤4000 字字段 + customFields ≤40 项，全量覆盖，返回整合文本。
- `generateAsset`：`{profileId, stateKey, stateBrief≤1000, extra≤1000}`。
- `activateProfile`：校验未归档且 base 槽位已有选中素材；写 activations
 （`providerStatus='local_record'`，快照含 `mode:'shared_base' / baseAssetId /
  baseAssetSha256 / stateSelections / settingsText`）；**不调用 Muse avatar.set、
  不改运行时头像、不改长期记忆**。
- `uploadAsset`：仅 png/jpeg/webp/gif/mp4/webm，存 blobs，算 SHA-256。
- 能力常量（服务端硬编码，已审计）：`mode='shared_base'`，
  `independentStateAssets=false`，`candidateIdReusable=false`，
  `sharedBaseAvatar=true`；10 条 state_definitions，仅 base configurable=1；
  完成度分母只计 configurable 槽位（x/1）。

## 七、运行时素材

见 `client/src/assets/runtime/README.md`。本目录不复制 164690 字节大图：
内置 `base.webp` 即已恢复的 v1 原图，1600×1600，MD5
`2fb6bdc0c46ff85bdc77bc6285d26d9d`，长黑发、右眼蓝色火焰、白衬衫、黑外套（蓝线）、
黑裙、过膝袜、黑靴。本地验证用的同一文件在 `~/workspace/reverse-test/v1-exact.webp`。

## 八、自查结果（实跑，非声称）

2026-11-26，`~/workspace/projects/muse-character-studio/`：

1. `bun install`：通过，110 个包，23.16s，生成 `bun.lock`。
2. `bun x tsc --noEmit`：第一轮报 2 错——Workspace `confirmLabel` 未进 state
   类型、GalleryCard `isAuto` 未使用；修复后重跑，**通过，exit 0，无输出**。
3. `vite build`：第一轮报 Tailwind v4 `@apply` 自定义类失败
  （`Cannot apply unknown utility class 'btn'`）；按第四节改为纯 CSS 变体后重跑，
   **通过，exit 0**，141 个模块，`dist/index.html 0.41 kB`，
   `index-*.css 26.07 kB`，`index-*.js 335.05 kB`（gzip 104.73 kB）。
   构建产物 `dist/` 已删除，`.gitignore` 忽略 `node_modules/` 与 `dist/`。
5. 后端（2026-11-26 新增，见第十二节）：`bun run typecheck`（前端 +
   服务端）exit 0；`bun run build` exit 0；后端实测 45 项动作检查全过
   （种子、设定读写、上传 SHA-256、激活守则、导出导入、MUSE_DEPENDENT
   报错等），另 17 项补测通过 16 项（1 项是测试期望本身写错，已单独复核
   实现正确），前端
   `dev:full` 下经 Vite 代理调 getStudio 正常，api.ts 的 File→base64
   转换单测通过。测试数据库已清空，首次启动是干净的。

## 九、如何应用到线上 artifact（需用户确认后才能做）

本轮**没有**调用 `artifact.edit` / `artifact.create` / `artifact.inspect`，
线上 `space:muse-character-studio` 未动。

应用步骤（由主 agent 在用户确认后执行）：
1. 用户确认本目录代码无误，或先在本地 `bun run dev:full` 看一遍。
2. 用 `artifact.edit`（slug `muse-character-studio`）把本轮前端文件
   （`client/src/*`、`theme.css`）提交为新版本；后端 `server/src/*` 不动。
3. 构建完成后在工作室里走验收清单（第十节），重点看 A/B 卡切换、
   画廊 base 槽位、设定保存不丢草稿、390px 标题。
4. 如构建方对文件结构有不同要求，以构建方的反馈为准，不要直接覆盖线上
   `app.db`（Web artifact 的记录只能通过 `artifact.inspect` / 声明的 actions
   读写，禁止直接访问 `app.db`）。

## 十、验收清单

- [ ] 角色库：封面为图（非单字占位），同名 A/B 卡可区分，收藏切换正常，进度条与数字一致。
- [ ] 工作台：Hero 有封面/名称/副标题/简介/激活/编辑，Tab 切换不丢设定草稿与生成简述草稿。
- [ ] 画廊：base 槽位显示当前选定素材；其余状态标注“自动驱动”，不要求手动配图；无双灰框并排。
- [ ] 设定：7 组齐全，行为规则独立成组，自定义字段可增删，整合预览可读，保存后草稿清除。
- [ ] 生成：候选与正式素材分离，采纳后才进画廊，不覆盖旧素材。
- [ ] 激活：成功有明确反馈，失败不覆盖原激活记录；激活不改运行时头像（以本地记录为准）。
- [ ] 危险操作：归档/删除/删素材均有确认框；已激活引用素材不可删。
- [ ] 响应式：1280px 桌面、768px 平板、390px 手机下标题不截断、无横向溢出、无控制台报错。
- [ ] 上传/导入：B 卡上传小图能进素材库；系统页“导入为基础形象”按 MD5 核对（见 A 卡验证流程）。

## 十一、还需要用户确认才能应用到线上的地方

1. **是否用这套前端替换线上 artifact**：确认后主 agent 才能调用 `artifact.edit`。
2. **390px 真机复测**：代码已修，但本轮未在真机/浏览器复测，应用后需在手机端看一眼“当前激活角色”标题。
3. **文件上传与一键导入运行时原图**：服务端已用真实字节测通，浏览器实际点按尚未验证（见 A 卡验证流程）；应用后请按 README 第十节核对。
4. **版本锁定**：是否把 `^` 改为精确版本号（React 19.2.5 / Tailwind 4.1.13 /
   react-query 5.100.10 / zod 4.4.3），还是接受本次解析到的兼容新版。
5. **seed 数据**：首开自动种入 A（原作人格，favorite=1）与 B（日常人格，favorite=0）
   两张同名卡，cover_asset_id 均为 null（用运行时 base 图作封面），是否保留。

## 十二、后端（本地真后端，2026-11-26 新增）

本地现在有能独立跑的真后端了，不再是只有前端。线上工作室的 30 个动作
按线上请求 schema 与实测返回完整还原在 `server/src/` 里，数据存在本地
SQLite，跑法见第二节（`bun run dev:full`）。

- 入口：`server/src/http.ts`（Bun，端口 8787，`GET /health`、`POST /actions`、`GET /assets/…`）
- 动作：`server/src/actions.ts`（线上 30 个真实动作 + 9 个本地兼容别名，见 `server/BACKEND.md`）
- 模型：`server/src/schema.ts`（SQLite 建表与映射）、`server/src/seed.ts`（A/B 两张卡与 10 条状态定义，按线上实测原样）
- Muse 依赖：`server/src/muse.ts`（generateAsset / clearAvatar / getRuntimeAssets / importRuntimeBase 的警告集中处）
- 详细说明：`server/BACKEND.md`（动作清单、与线上差异、警告表、启动与重置方法）
- 数据文件：`server/data/studio.db`（SQLite）与 `server/data/assets/`（素材文件），都在 `.gitignore` 里，不提交；删掉 `server/data/` 即重置回首开状态。

⚠️ 有 4 个功能依托 Muse，本地跑不起来，设计上就是明确报错或返回 warning，
绝不伪造（完整警告表见 `server/BACKEND.md`）：

| 功能 | 本地表现 |
| --- | --- |
| 生成图片（generateAsset） | 报错 `[MUSE_DEPENDENT]`，不产生假图；失败任务会记一条 error 记录 |
| 读取 Muse 运行时形象（getRuntimeAssets） | 返回空结果 + warning，不编造运行时帧 |
| 清除 Muse 头像（clearAvatar） | 报错 `[MUSE_DEPENDENT]`，本地资产不受影响 |
| 一键导入运行时原图（importRuntimeBase） | 本地没有 base.webp 时报错；把原图放到 `server/data/runtime-base.webp` 后可导入，MD5 会核对 |

线上工作室的数据与本地数据不互通：线上是线上的一套，本地是本地的一套，
种子 id 相同但内容各自独立，改本地不会动线上。
