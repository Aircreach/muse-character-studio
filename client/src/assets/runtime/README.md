# 运行时素材 · base.webp（说明，不随仓库复制大图）

本目录不存放 164690 字节的原图文件，原因：不要把大图二进制塞进本地重写目录；
线上 artifact 内置的 base.webp 与本地已验证的 v1 原图是同一字节。

- 来源：Muse 当前运行时头像（已恢复的 v1 黑岩射手原图）
- 文件：`base.webp`（线上 artifact 内置；本地用 `/assets/runtime/base.webp` 引用）
- 尺寸：1600×1600
- 大小：164690 字节
- MD5：`2fb6bdc0c46ff85bdc77bc6285d26d9d`
- SHA-256：以服务端 uploadAsset / importRuntimeBase 计算为准，导入时备注里带 MD5
- 内容：长黑发、右眼蓝色火焰、白衬衫、黑外套（蓝线）、黑裙、过膝袜、黑靴

本地验证用的同一文件（不要提交进本目录）：
- `~/workspace/reverse-test/v1-exact.webp`（MD5 同上）
- 回收站备份：`black-rock-shooter/v1-option1/active-avatar.webp`（2026-12-26 前可恢复）

应用到线上时：把线上 artifact 的 `base.webp` 保持原样，不要用重新生成的图替换它；
“导入为基础形象”取的就是这张内置图。
