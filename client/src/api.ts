// API client — contract only, no backend changes.
// The server exposes actions over POST ./actions via createActionClient.
// Every function below keeps the existing request/response shape and Zod
// validation. In particular:
// - getStudio({}) -> { profiles, activeProfileId, capabilities }
// - getProfileDetail({id}) -> ProfileDetail (see shared.ts)
// - saveSettings: 线上形状是 { profileId, settings } 全量 32 字段
//   （各 ≤4000 字 + customFields ≤40 项，全量覆盖，返回整合文本）；
//   本地前端发的是 { profileId, patch }，本地后端两种都接受。
// - generateAsset: {profileId, stateKey, stateBrief ≤1000, extra ≤1000};
//   the product is status=candidate until adoptCandidate moves it in.
// - activateProfile: rejects archived profiles and profiles whose base
//   slot has no selected asset; writes activations with
//   providerStatus='local_record' and a snapshot
//   {mode:'shared_base', baseAssetId, baseAssetSha256, stateSelections,
//   settingsText}. It does NOT call Muse avatar.set, does not change the
//   runtime avatar, and does not touch long-term memory.
// - uploadAsset: 线上形状是 { profileId, dataBase64, mimeType, ... }，
//   仅 png/jpeg/webp/gif/mp4/webm，算 SHA-256。
//
// 动作清单以线上真实发布的 30 个为准（见 server/BACKEND.md）。
// 下面标 [LOCAL ALIAS] 的 9 个动作线上不发布，只为本地前端兼容而存在，
// 不要假装线上就有它们：selectAsset、deleteCandidate、getSettingsText、
// importRuntimeBase、listActivations、getRuntimeAssets、verifyAssetIntegrity、
// clearAvatar、listGenerationJobs。
//
// 传输转换：线上 artifact 的 createActionClient 由平台提供，原生会把
// File 转成 base64 再发；本地 Vite 发不出 File，所以这里的 fetch 封装
// 在 JSON.stringify 之前把入参里的 File/Blob 转成 { dataBase64, mimeType }。
// 这只是传输层转换，不改业务逻辑。

import type { CharacterSettings } from './shared'

export interface ActionFn<I, O> {
  (input: I): Promise<O>
}

export type Actions = {
  seedStudio: ActionFn<Record<string, never>, { seeded: boolean; profileIds: string[] }>
  getStudio: ActionFn<Record<string, never>, import('./shared').StudioOverview>
  getCapabilities: ActionFn<Record<string, never>, import('./shared').Capabilities>
  getProfileDetail: ActionFn<{ id: string }, import('./shared').ProfileDetail>
  createProfile: ActionFn<
    { name: string; subtitle?: string; description?: string; tags?: string[] },
    { profile: import('./shared').CharacterProfile }
  >
  updateProfile: ActionFn<
    { id: string; name?: string; subtitle?: string; description?: string; tags?: string[] },
    { profile: import('./shared').CharacterProfile }
  >
  toggleFavorite: ActionFn<{ id: string }, { profile: import('./shared').CharacterProfile }>
  archiveProfile: ActionFn<{ id: string }, { profile: import('./shared').CharacterProfile }>
  restoreProfile: ActionFn<{ id: string }, { profile: import('./shared').CharacterProfile }>
  deleteProfile: ActionFn<{ id: string }, { deleted: boolean }>
  duplicateProfile: ActionFn<{ id: string }, { profile: import('./shared').CharacterProfile }>
  saveSettings: ActionFn<
    { profileId: string; settings?: CharacterSettings; patch?: import('./shared').SettingsPatch },
    { settings: import('./shared').CharacterSettings; settingsText: string }
  >
  uploadAsset: ActionFn<
    { profileId: string; stateKey?: string | null; file: File; note?: string },
    { asset: import('./shared').Asset }
  >
  selectStateAsset: ActionFn<
    { profileId: string; stateKey: string; assetId: string },
    { slot: import('./shared').StateSlot }
  >
  linkAssetToState: ActionFn<
    { profileId: string; stateKey: string; assetId: string },
    { slot: import('./shared').StateSlot }
  >
  unlinkStateAsset: ActionFn<{ linkId: string }, { deleted: boolean; slot: import('./shared').StateSlot }>
  deleteAsset: ActionFn<{ profileId: string; assetId: string }, { deleted: boolean }>
  setCover: ActionFn<{ profileId: string; assetId: string | null }, { profile: import('./shared').CharacterProfile }>
  setReference: ActionFn<
    { profileId: string; assetId: string; kind: 'appearance' | 'style' },
    { reference: { id: string; profileId: string; assetId: string; kind: string; createdAt: string } }
  >
  removeReference: ActionFn<{ id: string }, { deleted: boolean }>
  generateAsset: ActionFn<
    { profileId: string; stateKey: string; stateBrief: string; extra: string },
    { candidate: import('./shared').GenerationCandidate; jobId: string }
  >
  adoptCandidate: ActionFn<
    { profileId: string; candidateId: string; stateKey: string },
    { asset: import('./shared').Asset; slot: import('./shared').StateSlot }
  >
  discardCandidate: ActionFn<{ candidateId: string }, { discarded: boolean }>
  activateProfile: ActionFn<
    { profileId: string; note?: string },
    { activation: import('./shared').ActivationRecord; activeProfileId: string }
  >
  deactivateProfile: ActionFn<Record<string, never>, { activeProfileId: null }>
  exportProfile: ActionFn<{ profileId: string }, { json: string }>
  importProfile: ActionFn<{ json: string } | { profileJson: string; settingsJson: string }, { profile: import('./shared').CharacterProfile }>
  addStateDefinition: ActionFn<
    { stateKey: string; name: string; description?: string },
    { definition: import('./shared').StateDefinition }
  >
  updateStateDefinition: ActionFn<
    { id: string; name: string; description: string; required: boolean; sortOrder: number },
    { definition: import('./shared').StateDefinition }
  >
  deleteStateDefinition: ActionFn<{ id: string }, { deleted: boolean }>
  /** [LOCAL ALIAS] 线上不发布，等价于 selectStateAsset。 */
  selectAsset: ActionFn<
    { profileId: string; stateKey: string; assetId: string },
    { slot: import('./shared').StateSlot }
  >
  /** [LOCAL ALIAS] 线上不发布，等价于 discardCandidate。 */
  deleteCandidate: ActionFn<{ candidateId: string }, { discarded: boolean }>
  /** [LOCAL ALIAS] 线上不发布：由 getProfileDetail 派生的只读查询。 */
  getSettingsText: ActionFn<{ profileId: string }, { settingsText: string }>
  /** [LOCAL ALIAS] 线上不发布：本地原图导入，线上对应流程是 uploadAsset source='imported'。 */
  importRuntimeBase: ActionFn<{ profileId: string }, { asset: import('./shared').Asset; alreadyPresent: boolean }>
  /** [LOCAL ALIAS] 线上不发布：由 getProfileDetail 派生的只读查询。 */
  listActivations: ActionFn<{ profileId: string }, { activations: import('./shared').ActivationRecord[] }>
  /** [LOCAL ALIAS] 线上不发布：本地无法访问 Muse 运行时，返回带 warning 的空结果。 */
  getRuntimeAssets: ActionFn<
    Record<string, never>,
    { baseImageUrl: string | null; baseSha256: string | null; stateFrames: Record<string, string>; warning?: string }
  >
  /** [LOCAL ALIAS] 线上不发布：本地校验素材文件与 SHA-256。 */
  verifyAssetIntegrity: ActionFn<{ profileId: string }, { checked: number; mismatched: string[] }>
  /** [LOCAL ALIAS] 线上不发布：本地无法访问 Muse 运行时，调用会明确报错。 */
  clearAvatar: ActionFn<Record<string, never>, { cleared: boolean }>
  /** [LOCAL ALIAS] 线上不发布：由 getProfileDetail 派生的只读查询。 */
  listGenerationJobs: ActionFn<{ profileId: string }, { jobs: import('./shared').ProfileDetail['jobs'] }>
}

/** 把入参里的 File/Blob 转成 { dataBase64, mimeType }（见文件头注释）。 */
async function encodeFiles(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer())
    let binary = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return { dataBase64: btoa(binary), mimeType: value.type }
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => encodeFiles(v)))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'file' && v instanceof Blob) {
        const encoded = (await encodeFiles(v)) as { dataBase64: string; mimeType: string }
        out.dataBase64 = encoded.dataBase64
        out.mimeType = encoded.mimeType
      } else {
        out[key] = await encodeFiles(v)
      }
    }
    return out
  }
  return value
}

/**
 * Minimal createActionClient stand-in with the same call shape as the
 * online artifact: POST ./actions with {action, input}, returns {result}.
 * In the real artifact this is supplied by the platform; here it is a
 * typed fetch wrapper so the local code typechecks and runs standalone
 * against the local backend (server/src/http.ts, bun run dev:full).
 */
export function createActionClient<T extends Record<string, ActionFn<never, unknown>>>(): {
  [K in keyof T]: T[K]
} {
  const handler = {
    get(_target: unknown, action: string) {
      return async (input: unknown) => {
        const encoded = await encodeFiles(input ?? {})
        const res = await fetch('./actions', {
          body: JSON.stringify({ action, input: encoded }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Action ${action} failed (${res.status}): ${text.slice(0, 400)}`)
        }
        const data = (await res.json()) as { result?: unknown; error?: string }
        if (data.error) throw new Error(data.error)
        return data.result as unknown
      }
    },
  }
  return new Proxy({}, handler) as { [K in keyof T]: T[K] }
}

export const api = createActionClient<Actions>()

export const STUDIO_KEY = ['studio'] as const
export const profileKey = (id: string) => ['profile', id] as const
