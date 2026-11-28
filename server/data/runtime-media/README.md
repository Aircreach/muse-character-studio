# server/data/runtime-media/ — 完整示例角色数据（已进仓库）

本目录是仓库里一份完整的角色示例数据：Muse 当前运行时头像（v1 黑岩射手）
的真实媒体，共 19 个文件，约 12 MB，供本地后端 `getRuntimeAssets` 扫描返回。
2026-11-28 起进仓库（用户决定：给一份完整的角色数据），克隆后
`getRuntimeAssets` 开箱即用，不用再手动放图。

## 文件约定（19 个）

- `base.webp` — 运行时原图（v1，MD5 `2fb6bdc0c46ff85bdc77bc6285d26d9d`）
- `base-dark.webp` — 深色版原图
- `<state>.webp` — 5 个状态的静态帧：idle、waking、working、making_something、milestone_level_up
- `<state>.mp4` — 7 个状态的视频：connecting、idle、waiting_for_subagents（这三个共用同一文件）、waking、working、making_something、milestone_level_up
- `<state>-dark.mp4` — 5 个状态的深色视频：idle、waking、working、making_something、milestone_level_up

## 来源与恢复

全部来自 `~/workspace/avatars/`（当前头像 stem `avatar-1795685697554236405-6`）：
基础图与深色图直接复制；静态帧在 `.frames/static-<编号>-<state>.webp`；
视频按 `video_variants_json` 里的文件名复制。不要从别处找图冒充。

本目录被误删时从仓库重新取回即可；目录不存在或无可识别文件时，
`getRuntimeAssets` 返回空 + warning（不编造）。清理 `server/data/` 时只删
测试库（`studio.db*`、`assets/`），不要碰本目录。
