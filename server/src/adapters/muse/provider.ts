// server/src/adapters/muse/provider.ts — Muse 运行时交互的抽象契约（解耦边界）。
//
// 架构原则（与 Muse 确认的硬性约束）：
// 1. 核心业务层（profiles / settings / gallery / assets / activations）只依赖本接口，
//    不直接 import 任何具体的 Muse 运行时实现或本地媒体文件系统细节。
// 2. activateProfile 属于核心本地业务（只写 activations + active_profile，状态为 local_record），
//    绝不隐式调用 Muse avatar.set；与 Muse 头像同步必须是显式、独立的第二步（activateCandidate / syncActivation）。
// 3. getCapabilities() 是能力矩阵的唯一事实来源，前端与核心业务层按其返回值动态适配。
// 4. 任何依托 Muse 但本地不可用的能力，必须抛出带 [MUSE_DEPENDENT] 前缀的错误或返回 warning，绝不伪造。

import type { Capabilities, RuntimeAssetsResult } from '../../../client/src/shared'

export const MUSE_DEPENDENT_CODE = 'MUSE_DEPENDENT'

export const RUNTIME_BASE_MD5 = '2fb6bdc0c46ff85bdc77bc6285d26d9d'
export const RUNTIME_BASE_HINT =
  '本地没有 base.webp：client/src/assets/runtime/ 下只有说明、没有大图。' +
  '已知同字节副本在 ~/workspace/reverse-test/v1-exact.webp（MD5 2fb6bdc0c46ff85bdc77bc6285d26d9d，1600×1600，164690 字节），' +
  '把它复制到 server/data/runtime-base.webp 后重试；或在线上工作室用系统页“一键导入运行时原图”。'

/** 带机器可读 code 的 Muse 依赖错误；http.ts 把它原样放进 { error }。 */
export class MuseDependentError extends Error {
  readonly code = MUSE_DEPENDENT_CODE
  constructor(message: string) {
    super(`[${MUSE_DEPENDENT_CODE}] ${message}`)
    this.name = 'MuseDependentError'
  }
}

export interface MuseCapabilities extends Capabilities {
  darkModeVariants: boolean
  notes: string[]
  runtimeAvatar: {
    label: string
    md5: string
    width: number
    height: number
    sourcePath: string
    note: string
  }
  runtimeStates: Array<{ stateKey: string; name: string; kind: string }>
}

export interface RuntimeBaseFile {
  path: string
  bytes: Uint8Array
}

export interface MuseGenerateInput {
  profileId: string
  stateKey: string
  stateBrief: string
  extra: string
  settingsText: string
}

export interface MuseGeneratedMedia {
  bytes: Uint8Array
  mimeType: string
  prompt: string
}

export interface MuseActivationSnapshot {
  mode: Capabilities['mode']
  baseAssetId: string
  baseAssetSha256: string | null
  stateSelections: Record<string, string | null>
  settingsText: string
  note?: string
}

export interface MuseSyncResult {
  synced: boolean
  providerStatus: 'local_record' | 'synced' | 'unsupported'
  warning?: string
}

/**
 * MuseRuntimeProvider — 平台与 Muse 运行时的唯一隔离边界。
 * LocalMuseProvider（本地开发）与 OnlineMuseProvider（线上 artifact 适配层）各自实现此契约，
 * 在组合根（http.ts / artifact runtime）注入 ActionContext。
 */
export interface MuseRuntimeProvider {
  readonly kind: 'local' | 'online'
  getCapabilities(): MuseCapabilities
  generateAsset(input: MuseGenerateInput): Promise<MuseGeneratedMedia>
  getRuntimeAssets(): Promise<RuntimeAssetsResult>
  activateCandidate(candidateId: string): Promise<MuseSyncResult>
  syncActivation?(snapshot: MuseActivationSnapshot): Promise<MuseSyncResult>
  clearAvatar(): Promise<{ cleared: boolean }>
  readRuntimeBase(): Promise<RuntimeBaseFile>
  getHealthWarning(): string
}
