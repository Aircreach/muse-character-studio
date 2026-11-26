// server/src/muse.ts — 所有依托 Muse 才能跑的功能集中在这里。
//
// 原则（用户要求）：绝不伪造。本地后端没有 Muse 的 generate_media、
// 没有运行时头像、没有候选流程，凡是需要这些的功能必须明确报错或
// 返回带 warning 的空结果，绝不生成假图、绝不编造运行时帧、
// 绝不静默假装成功。每个入口都在返回/错误里写清原因与替代做法。

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const MUSE_DEPENDENT_CODE = 'MUSE_DEPENDENT'

/** 带机器可读 code 的 Muse 依赖错误；http.ts 把它原样放进 {error}。 */
export class MuseDependentError extends Error {
  readonly code = MUSE_DEPENDENT_CODE
  constructor(message: string) {
    super(`[${MUSE_DEPENDENT_CODE}] ${message}`)
    this.name = 'MuseDependentError'
  }
}

export function generateAssetUnavailable(): never {
  throw new MuseDependentError(
    'generateAsset 需要 Muse 的 generate_media 才能生成图片；本地后端无法调用 Muse，也不会生成假图。' +
      '替代做法：在 Muse 线上工作室里生成候选，或先用 uploadAsset 上传一张真实图片。',
  )
}

export function clearAvatarUnavailable(): never {
  throw new MuseDependentError(
    'clearAvatar 需要访问 Muse 运行时头像；本地后端够不到 Muse 运行时，本地资产库也不会被清理。' +
      '替代做法：在 Muse 本人处清除头像；工作室的本地素材不受影响。',
  )
}

/** getRuntimeAssets：本地无法访问 Muse 运行时，返回带 warning 的空结果。 */
export function runtimeAssetsUnavailable(): {
  baseImageUrl: string | null
  baseSha256: string | null
  stateFrames: Record<string, string>
  warning: string
} {
  return {
    baseImageUrl: null,
    baseSha256: null,
    stateFrames: {},
    warning:
      '本地后端无法访问 Muse 运行时：没有运行时原图 URL、没有 SHA-256、没有运行时状态帧。' +
      '线上工作室里 getCapabilities 返回的 runtimeAvatar（MD5 2fb6bdc0c46ff85bdc77bc6285d26d9d）才是真实值；' +
      '本地不要用任何图片冒充运行时帧。',
  }
}

// ---- importRuntimeBase 的本地原图来源 ----
//
// 查找顺序（都不复制、不提交进仓库）：
//  1. client/src/assets/runtime/base.webp（线上 artifact 内置图的本地放置位；
//     当前仓库里只有 README 说明，没有这张大图）
//  2. server/data/runtime-base.webp（用户手动放置位；见 BACKEND.md）
// 都没有时报错，并在错误里告诉用户已知的同字节副本位置。
export const RUNTIME_BASE_MD5 = '2fb6bdc0c46ff85bdc77bc6285d26d9d'
export const RUNTIME_BASE_HINT =
  '本地没有 base.webp：client/src/assets/runtime/ 下只有说明、没有大图。' +
  '已知同字节副本在 ~/workspace/reverse-test/v1-exact.webp（MD5 2fb6bdc0c46ff85bdc77bc6285d26d9d，1600×1600，164690 字节），' +
  '把它复制到 server/data/runtime-base.webp 后重试；或在线上工作室用系统页“一键导入运行时原图”。'

export interface RuntimeBaseFile {
  path: string
  bytes: Uint8Array
}

export async function readLocalRuntimeBase(projectRoot: string): Promise<RuntimeBaseFile> {
  const candidates = [
    join(projectRoot, 'client/src/assets/runtime/base.webp'),
    join(projectRoot, 'server/data/runtime-base.webp'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
      return { path, bytes }
    }
  }
  throw new MuseDependentError(`importRuntimeBase 无法在本地找到运行时原图。${RUNTIME_BASE_HINT}`)
}
