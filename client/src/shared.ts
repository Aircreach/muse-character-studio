// Shared domain types. These mirror the server (Drizzle) model described in
// server/src/schema.ts — frontend only; do not change the backend model here.
// Identity rule: profile.id (UUIDv7) is the identity. name may repeat.

export type MediaType = 'image' | 'video' | 'animation'
export type AssetSource = 'upload' | 'generated' | 'imported'

export interface Asset {
  id: string
  profileId: string
  mediaType: MediaType
  format: string
  filePath: string
  thumbnailPath: string | null
  width: number | null
  height: number | null
  fileSize: number | null
  sha256: string | null
  source: AssetSource
  prompt: string | null
  createdAt: string
  /** UI-only: preview URL supplied by the server for this asset. */
  url?: string | null
  /** UI-only: human note, e.g. “MD5 2fb6… · 原图恢复”. */
  note?: string | null
}

export interface StateDefinition {
  id: string
  stateKey: string
  name: string
  description: string
  required: boolean
  /** Only `base` is configurable in shared_base mode. */
  configurable: boolean
  /** Runtime-only states (idle/waking/…) have a runtimeStateKey; the rest are null. */
  runtimeStateKey: string | null
  sortOrder: number
}

export interface SlotAsset extends Asset {
  linkId: string
  isSelected: boolean
}

export interface StateSlot {
  stateKey: string
  selectedAssetId: string | null
  assets: SlotAsset[]
}

export interface CustomField {
  key: string
  value: string
}

export interface CharacterSettings {
  id: string
  profileId: string
  characterName: string
  identity: string
  origin: string
  background: string
  worldSetting: string
  relationship: string
  personality: string
  temperament: string
  values: string
  strengths: string
  weaknesses: string
  emotionalTraits: string
  quirks: string
  speakingStyle: string
  tone: string
  vocabulary: string
  addressStyle: string
  responseStyle: string
  catchphrases: string
  forbiddenBehaviors: string
  appearance: string
  hair: string
  eyes: string
  outfit: string
  accessories: string
  bodyFeatures: string
  colorPalette: string
  visualStyle: string
  consistencyRules: string
  generationPrompt: string
  negativePrompt: string
  compositionPreferences: string
  imageConstraints: string
  customFields: CustomField[]
}

export type SettingsPatch = Partial<Omit<CharacterSettings, 'id' | 'profileId' | 'customFields'>> & {
  customFields?: CustomField[]
}

export interface CharacterProfile {
  id: string
  name: string
  subtitle: string | null
  description: string | null
  coverAssetId: string | null
  settingsId: string | null
  galleryId: string | null
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  /** Denormalised by getStudio for the library cards. */
  coverUrl?: string | null
  progress?: { configured: number; total: number }
}

export interface Capabilities {
  mode: 'shared_base' | 'independent_state'
  avatarSupported: boolean
  candidateActivation: boolean
  staticImage: boolean
  videoVariants: boolean
  independentStateAssets: boolean
  sharedBaseAvatar: boolean
  candidateIdReusable: boolean
  availableStates: string[]
  darkModeVariants?: boolean
  notes?: string[]
  runtimeAvatar?: {
    label: string
    md5: string
    width: number
    height: number
    sourcePath: string
    note: string
  }
  runtimeStates?: Array<{ stateKey: string; name: string; kind: string }>
}

/** Audited constants (server hard-coded, 2026-11-26). Do not invent support. */
export const AUDITED_CAPABILITIES: Capabilities = {
  mode: 'shared_base',
  avatarSupported: true,
  candidateActivation: true,
  staticImage: true,
  videoVariants: true,
  independentStateAssets: false,
  sharedBaseAvatar: true,
  candidateIdReusable: false,
  availableStates: ['idle', 'waking', 'working', 'making_something', 'milestone_level_up'],
}

export interface GenerationCandidate {
  id: string
  profileId: string
  stateKey: string
  assetId: string | null
  url: string | null
  prompt: string
  status: 'candidate' | 'adopted' | 'discarded'
  createdAt: string
}

/**
 * 一条真实运行时媒体（getRuntimeAssets 返回的 items 元素；与
 * server/src/muse.ts 的 RuntimeMediaItem 同形）。kind 按文件类型定：
 * 视频（mp4/webm）播，静态帧（webp/png/jpeg/gif）显示；label 永远
 * 写明类型与来源，不拿基础图冒充各状态帧。
 */
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

export interface ActivationRecord {
  id: string
  profileId: string
  activatedAt: string
  providerStatus: 'local_record'
  snapshotJson: string
}

export interface ProfileDetail {
  profile: CharacterProfile
  settings: CharacterSettings | null
  settingsText: string
  stateDefs: StateDefinition[]
  slots: StateSlot[]
  assets: Asset[]
  candidates: GenerationCandidate[]
  references: Asset[]
  jobs: Array<{ id: string; stateKey: string; status: string; createdAt: string }>
  activations: ActivationRecord[]
  isActive: boolean
}

export interface StudioOverview {
  profiles: CharacterProfile[]
  activeProfileId: string | null
  capabilities: Capabilities
}

export type View =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'workspace'; id: string }
  | { kind: 'system' }

export const RUNTIME_BASE_MD5 = '2fb6bdc0c46ff85bdc77bc6285d26d9d'
export const RUNTIME_BASE_BYTES = 164690
export const RUNTIME_BASE_SIZE = '1600×1600'
