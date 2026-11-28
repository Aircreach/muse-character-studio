// server/src/muse.ts — 所有依托 Muse 才能跑的功能集中在这里。
//
// 原则（用户要求）：绝不伪造。本地后端没有 Muse 的 generate_media、
// 没有运行时头像、没有候选流程，凡是需要这些的功能必须明确报错或
// 返回带 warning 的空结果，绝不生成假图、绝不编造运行时帧、
// 绝不静默假装成功。每个入口都在返回/错误里写清原因与替代做法。
//
// 例外（getRuntimeAssets）：本地够不到 Muse 运行时，但用户可以把真实
// 运行时媒体文件放到 server/data/runtime-media/（见下文命名约定），
// getRuntimeAssets 就会返回这份真实清单——文件是用户亲手放的真实
// 媒体，不是后端编造的，所以不违反“不伪造”原则。

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

/** getRuntimeAssets：本地没有运行时媒体时，返回带 warning 的空结果。 */
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
      '本地不要用任何图片冒充运行时帧。把真实运行时媒体放到 server/data/runtime-media/（命名见 readRuntimeMedia 注释与 BACKEND.md）后，' +
      'getRuntimeAssets 会返回真实清单。',
  }
}

// ---- getRuntimeAssets 的真实媒体清单 ----
//
// 来源约定：server/data/runtime-media/（gitignored，不进仓库；与
// importRuntimeBase 用 server/data/runtime-base.webp 的模式一致）。
// 该目录由用户亲手放置真实文件，后端只做“按名识别、原样返回”，
// 不生成、不改名、不编造；目录不存在或没有可识别文件时，仍返回
// 空 + warning（不编造），行为与以前一致。
//
// 命名约定（stateKey 取自状态定义，另加 base；-dark 为深色版）：
//   <state>.mp4 / <state>.webm            浅色视频（有视频时 kind='video'）
//   <state>-dark.mp4 / <state>-dark.webm  深色视频
//   <state>.webp / .png / .jpg / .gif     浅色静态帧（兼视频 poster）
//   <state>-dark.webp …                   深色静态帧
//   base.webp                             基础形象原图（兼各视频无帧时的 poster）
//   base-dark.webp                        深色基础图
//
// 当前头像的真实文件在 ~/workspace/avatars/（v1 原图、5 张静态帧、
// 7 个状态的 MP4），复制到该目录后本地画廊即显示真实媒体。

export interface RuntimeMediaItem {
  stateKey: string
  kind: 'video' | 'image'
  url: string
  posterUrl: string | null
  darkUrl: string | null
  label: string
}

export interface RuntimeAssetsResult {
  baseImageUrl: string | null
  baseSha256: string | null
  stateFrames: Record<string, string>
  items: RuntimeMediaItem[]
  warning?: string
}

const RUNTIME_MEDIA_RE = /^([a-z][a-z0-9_]*)(-dark)?\.(mp4|webm|webp|png|jpe?g|gif)$/

export function readRuntimeMedia(projectRoot: string): RuntimeAssetsResult {
  const dir = join(projectRoot, 'server/data/runtime-media')
  const empty = (): RuntimeAssetsResult => ({ ...runtimeAssetsUnavailable(), items: [] })
  if (!existsSync(dir)) return empty()
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => RUNTIME_MEDIA_RE.test(n)).sort()
  } catch {
    return empty()
  }
  if (names.length === 0) return empty()
  type Found = { video?: string; videoDark?: string; image?: string; imageDark?: string }
  const found = new Map<string, Found>()
  for (const name of names) {
    const m = RUNTIME_MEDIA_RE.exec(name)
    if (!m) continue
    const entry = found.get(m[1]) ?? {}
    if (m[3] === 'mp4' || m[3] === 'webm') {
      if (m[2] === '-dark') entry.videoDark = name
      else entry.video = name
    } else if (m[2] === '-dark') entry.imageDark = name
    else entry.image = name
    found.set(m[1], entry)
  }
  const urlFor = (name: string) => `/assets/runtime-media/${name}`
  const base = found.get('base')
  const baseImageUrl = base?.image ? urlFor(base.image) : null
  let baseSha256: string | null = null
  if (base?.image) {
    try {
      baseSha256 = createHash('sha256').update(readFileSync(join(dir, base.image))).digest('hex')
    } catch {
      baseSha256 = null
    }
  }
  const stateFrames: Record<string, string> = {}
  const items: RuntimeMediaItem[] = []
  for (const stateKey of [...found.keys()].sort()) {
    const f = found.get(stateKey)!
    if (f.image) stateFrames[stateKey] = urlFor(f.image)
    const url = f.video ? urlFor(f.video) : f.image ? urlFor(f.image) : null
    if (!url) continue
    items.push({
      stateKey,
      kind: f.video ? 'video' : 'image',
      url,
      posterUrl: f.image ? urlFor(f.image) : baseImageUrl,
      darkUrl: f.videoDark ? urlFor(f.videoDark) : f.imageDark ? urlFor(f.imageDark) : null,
      label:
        stateKey === 'base'
          ? '基础形象 · Muse 运行时'
          : f.video
            ? '视频 · Muse 运行时'
            : '静态帧 · Muse 运行时',
    })
  }
  if (items.length === 0) return empty()
  return { baseImageUrl, baseSha256, stateFrames, items }
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
