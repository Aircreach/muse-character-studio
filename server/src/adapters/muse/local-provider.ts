// server/src/adapters/muse/local-provider.ts — 本地开发环境的 MuseRuntimeProvider 实现。
//
// 本地没有 Muse 的 generate_media / avatar 候选流 / 运行时头像：
// - generateAsset / clearAvatar / activateCandidate / syncActivation 明确抛出 [MUSE_DEPENDENT] 错误，绝不伪造。
// - getRuntimeAssets 仅读取 server/data/runtime-media/ 中真实存在的文件；目录为空时返回 warning 空结果。
// - readRuntimeBase 按顺序查找仓库内置或本地手动放置的 base.webp。

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RuntimeAssetsResult, RuntimeMediaItem } from '../../../client/src/shared'
import {
  MuseDependentError,
  RUNTIME_BASE_HINT,
  RUNTIME_BASE_MD5,
  type MuseActivationSnapshot,
  type MuseCapabilities,
  type MuseGenerateInput,
  type MuseGeneratedMedia,
  type MuseRuntimeProvider,
  type MuseSyncResult,
  type RuntimeBaseFile,
} from './provider'

/** 2026-11-26 线上 getCapabilities 实测原样能力矩阵（唯一事实来源）。 */
export const LOCAL_AUDITED_CAPABILITIES: MuseCapabilities = {
  mode: 'shared_base',
  avatarSupported: true,
  candidateActivation: true,
  staticImage: true,
  videoVariants: true,
  independentStateAssets: false,
  sharedBaseAvatar: true,
  candidateIdReusable: false,
  availableStates: ['idle', 'waking', 'working', 'making_something', 'milestone_level_up'],
  darkModeVariants: true,
  notes: [
    'Muse 头像候选 ID 为一次性凭证：任一候选被激活后，同批全部候选（含已激活者）立即失效，无法靠保存候选 ID 切换版本。',
    '工作室的 Asset ID 是永久身份：素材字节保存在工作室自己的存储中，不受 Muse 清除头像影响。',
    '当前 Muse 为 shared_base 模式：只有一个基础形象槽位可同步，其余动画状态由 Muse 内部系统根据基础形象生成，工作室不虚构独立状态槽位。',
    '在本工作室“激活”角色卡会写入本地激活记录与设定快照；把形象真正同步到 Muse 头像由 Muse 本人通过候选流程完成（可用已保存原图做文件互换精确恢复）。',
  ],
  runtimeAvatar: {
    label: 'Muse 当前运行时形象',
    md5: RUNTIME_BASE_MD5,
    width: 1600,
    height: 1600,
    sourcePath: 'workspace/avatars/avatar-1795685697554236405-6.webp',
    note: '经文件互换恢复的黑岩射手 v1 原图，MD5 与原始激活文件一致。本页展示的运行时状态帧为该形象的真实系统生成素材，只读。',
  },
  runtimeStates: [
    { stateKey: 'idle', name: '待机', kind: '静态帧 + 视频变体（系统生成）' },
    { stateKey: 'waking', name: '唤醒', kind: '静态帧 + 视频变体（系统生成）' },
    { stateKey: 'working', name: '工作中', kind: '静态帧 + 视频变体（系统生成）' },
    { stateKey: 'making_something', name: '制作中', kind: '静态帧 + 视频变体（系统生成）' },
    { stateKey: 'milestone_level_up', name: '里程碑', kind: '静态帧 + 视频变体（系统生成）' },
  ],
}

const RUNTIME_MEDIA_RE = /^([a-z][a-z0-9_]*)(-dark)?\.(mp4|webm|webp|png|jpe?g|gif)$/

export function runtimeAssetsUnavailable(): RuntimeAssetsResult {
  return {
    baseImageUrl: null,
    baseSha256: null,
    stateFrames: {},
    items: [],
    warning:
      '本地后端无法访问 Muse 运行时：没有运行时原图 URL、没有 SHA-256、没有运行时状态帧。' +
      '线上工作室里 getCapabilities 返回的 runtimeAvatar（MD5 2fb6bdc0c46ff85bdc77bc6285d26d9d）才是真实值；' +
      '本地不要用任何图片冒充运行时帧。把真实运行时媒体放到 server/data/runtime-media/ 后，getRuntimeAssets 会返回真实清单。',
  }
}

export function readRuntimeMedia(projectRoot: string): RuntimeAssetsResult {
  const dir = join(projectRoot, 'server/data/runtime-media')
  if (!existsSync(dir)) return runtimeAssetsUnavailable()
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => RUNTIME_MEDIA_RE.test(n)).sort()
  } catch {
    return runtimeAssetsUnavailable()
  }
  if (names.length === 0) return runtimeAssetsUnavailable()

  type Found = { video?: string; videoDark?: string; image?: string; imageDark?: string }
  const found = new Map<string, Found>()
  for (const name of names) {
    const m = RUNTIME_MEDIA_RE.exec(name)
    if (!m) continue
    const entry = found.get(m[1]) ?? {}
    if (m[3] === 'mp4' || m[3] === 'webm') {
      if (m[2] === '-dark') entry.videoDark = name
      else entry.video = name
    } else if (m[2] === '-dark') {
      entry.imageDark = name
    } else {
      entry.image = name
    }
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

  if (items.length === 0) return runtimeAssetsUnavailable()
  return { baseImageUrl, baseSha256, stateFrames, items }
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

export class LocalMuseProvider implements MuseRuntimeProvider {
  readonly kind = 'local' as const
  private readonly projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  getCapabilities(): MuseCapabilities {
    return LOCAL_AUDITED_CAPABILITIES
  }

  async generateAsset(_input: MuseGenerateInput): Promise<MuseGeneratedMedia> {
    throw new MuseDependentError(
      'generateAsset 需要 Muse 的 generate_media 才能生成图片；本地后端无法调用 Muse，也不会生成假图。' +
        '替代做法：在 Muse 线上工作室里生成候选，或先用 uploadAsset 上传一张真实图片。',
    )
  }

  async getRuntimeAssets(): Promise<RuntimeAssetsResult> {
    return readRuntimeMedia(this.projectRoot)
  }

  async activateCandidate(_candidateId: string): Promise<MuseSyncResult> {
    throw new MuseDependentError(
      'activateCandidate 依赖 Muse 线上头像候选流程（候选 ID 一次性）；本地后端不调用 avatar.set，也不会伪装同步成功。',
    )
  }

  async syncActivation(_snapshot: MuseActivationSnapshot): Promise<MuseSyncResult> {
    return {
      synced: false,
      providerStatus: 'local_record',
      warning: '本地模式不支持自动同步到 Muse 运行时；激活仅保存为 local_record 快照。',
    }
  }

  async clearAvatar(): Promise<{ cleared: boolean }> {
    throw new MuseDependentError(
      'clearAvatar 需要访问 Muse 运行时头像；本地后端够不到 Muse 运行时，本地资产库也不会被清理。' +
        '替代做法：在 Muse 本人处清除头像；工作室的本地素材不受影响。',
    )
  }

  async readRuntimeBase(): Promise<RuntimeBaseFile> {
    return readLocalRuntimeBase(this.projectRoot)
  }

  getHealthWarning(): string {
    return '本地后端（LocalMuseProvider）：generateAsset / clearAvatar 依托 Muse，本地会明确报错；getRuntimeAssets 在 server/data/runtime-media/ 有真实媒体时返回真实清单，没有时返回 warning 空结果，绝不伪造（见 server/BACKEND.md）。'
  }
}

export function createLocalMuseProvider(projectRoot: string): MuseRuntimeProvider {
  return new LocalMuseProvider(projectRoot)
}
