// API client — contract only, no backend changes.
// The server exposes actions over POST ./actions via createActionClient.
// Every function below keeps the existing request/response shape and Zod
// validation. In particular:
// - getStudio({}) -> { profiles, activeProfileId, capabilities }
// - getProfileDetail({id}) -> ProfileDetail (see shared.ts)
// - saveSettings: 32 fields ≤4000 chars + customFields ≤40 items, full
//   overwrite, returns the merged settings text.
// - generateAsset: {profileId, stateKey, stateBrief ≤1000, extra ≤1000};
//   the product is status=candidate until adoptCandidate moves it in.
// - activateProfile: rejects archived profiles and profiles whose base
//   slot has no selected asset; writes activations with
//   providerStatus='local_record' and a snapshot
//   {mode:'shared_base', baseAssetId, baseAssetSha256, stateSelections,
//   settingsText}. It does NOT call Muse avatar.set, does not change the
//   runtime avatar, and does not touch long-term memory.
// - uploadAsset: png/jpeg/webp/gif/mp4/webm only; stored as blobs;
//   SHA-256 is computed server-side.
//
// The 30 actions are listed in `Actions` below. This file is the single
// source of truth for the frontend; if the server adds an action, add it
// here with its exact input/output types — never invent a capability the
// server does not expose.

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
    { profileId: string; patch: import('./shared').SettingsPatch },
    { settings: import('./shared').CharacterSettings; settingsText: string }
  >
  getSettingsText: ActionFn<{ profileId: string }, { settingsText: string }>
  uploadAsset: ActionFn<
    { profileId: string; stateKey?: string | null; file: File; note?: string },
    { asset: import('./shared').Asset }
  >
  importRuntimeBase: ActionFn<
    { profileId: string },
    { asset: import('./shared').Asset; alreadyPresent: boolean }
  >
  selectAsset: ActionFn<
    { profileId: string; stateKey: string; assetId: string },
    { slot: import('./shared').StateSlot }
  >
  deleteAsset: ActionFn<{ profileId: string; assetId: string }, { deleted: boolean }>
  deleteCandidate: ActionFn<{ candidateId: string }, { deleted: boolean }>
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
    { profileId: string },
    { activation: import('./shared').ActivationRecord; activeProfileId: string }
  >
  deactivateProfile: ActionFn<Record<string, never>, { activeProfileId: null }>
  listActivations: ActionFn<
    { profileId: string },
    { activations: import('./shared').ActivationRecord[] }
  >
  exportProfile: ActionFn<
    { profileId: string },
    { profileJson: string; settingsJson: string }
  >
  importProfile: ActionFn<
    { profileJson: string; settingsJson: string },
    { profile: import('./shared').CharacterProfile }
  >
  getRuntimeAssets: ActionFn<
    Record<string, never>,
    { baseImageUrl: string; baseSha256: string; stateFrames: Record<string, string> }
  >
  verifyAssetIntegrity: ActionFn<
    { profileId: string },
    { checked: number; mismatched: string[] }
  >
  clearAvatar: ActionFn<Record<string, never>, { cleared: boolean }>
  listGenerationJobs: ActionFn<
    { profileId: string },
    { jobs: import('./shared').ProfileDetail['jobs'] }
  >
}

/**
 * Minimal createActionClient stand-in with the same call shape as the
 * online artifact: POST ./actions with {action, input}, returns {result}.
 * In the real artifact this is supplied by the platform; here it is a
 * typed fetch wrapper so the local code typechecks and runs standalone.
 */
export function createActionClient<T extends Record<string, ActionFn<never, unknown>>>(): {
  [K in keyof T]: T[K]
} {
  const handler = {
    get(_target: unknown, action: string) {
      return async (input: unknown) => {
        const res = await fetch('./actions', {
          body: JSON.stringify({ action, input: input ?? {} }),
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
