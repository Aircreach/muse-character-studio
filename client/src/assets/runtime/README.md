# 运行时素材 · base.webp（仓库自带一份示例原图）

本目录自 2026-11-28 起带一份示例原图 `base.webp`（用户决定：给一份示例素材，
其余视频/帧仍只放本地，不进仓库）。

- 来源：Muse 当前运行时头像（已恢复的 v1 黑岩射手原图）
- 文件：`base.webp`（仓库自带；本地用 `/assets/runtime/base.webp` 引用）
- 尺寸：1600×1600
- 大小：164690 字节
- MD5：`2fb6bdc0c46ff85bdc77bc6285d26d9d`
- SHA-256：以服务端 uploadAsset / importRuntimeBase 计算为准，导入时备注里带 MD5
- 内容：长黑发、右眼蓝色火焰、白衬衫、黑外套（蓝线）、黑裙、过膝袜、黑靴

有了这份示例，克隆仓库后 `importRuntimeBase` 开箱即用（优先读本目录的
`base.webp`），不用再手动放图；前端无封面时回退的 `/assets/runtime/base.webp`
也不再 404。

其余真实媒体（7 个状态的 MP4、5 张静态帧、深色版）也在仓库里，见
`server/data/runtime-media/`（完整示例角色数据，19 个文件），恢复方法见该目录的
`README.md`；线上 artifact 里内嵌的是同一批文件。

本地验证用的同一文件：
- `~/workspace/reverse-test/v1-exact.webp`（MD5 同上）
- 回收站备份：`black-rock-shooter/v1-option1/active-avatar.webp`（2026-12-26 前可恢复）

应用到线上时：把线上 artifact 的 `base.webp` 保持原样，不要用重新生成的图替换它；
“导入为基础形象”取的就是这张内置图。
