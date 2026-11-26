// server/src/actions.ts — 线上 Muse Character Studio 30 个真实动作的本地还原。
//
// 动作清单以线上 artifact.list_actions 为准（2026-11-26 实测）：
// activateProfile, addStateDefinition, adoptCandidate, archiveProfile,
// createProfile, deactivateProfile, deleteAsset, deleteProfile,
// deleteStateDefinition, discardCandidate, duplicateProfile, exportProfile,
// generateAsset, getCapabilities, getProfileDetail, getStudio, importProfile,
// linkAssetToState, removeReference, restoreProfile, saveSettings, seedStudio,
// selectStateAsset, setCover, setReference, toggleFavorite, unlinkStateAsset,
// updateProfile, updateStateDefinition, uploadAsset.
//
// Zod 校验与限额按线上各动作的请求 schema 逐项还原。
// 本地 api.ts 里多出的动作（getSettingsText、importRuntimeBase、selectAsset、
// deleteCandidate、listActivations、getRuntimeAssets、verifyAssetIntegrity、
// clearAvatar、listGenerationJobs）是本地兼容别名，见文件末尾 ALIASES，
// 线上并不发布它们，代码注释与 BACKEND.md 里都明确标注。
//
// 守则（与线上一致）：
// - activateProfile 只写本地激活记录 + 设定快照，不调 avatar.set、不改
//   运行时头像、不改长期记忆；归档/删除激活中的卡会被阻止；
//   deleteAsset 在素材被选中时被阻止；base 状态定义不可删除；
//   duplicateProfile 共享素材不复制文件；exportProfile 只导 JSON 不嵌
//   素材字节；importProfile 只恢复 profile + settings，不恢复素材文件。
// - generateAsset / clearAvatar / getRuntimeAssets 依托 Muse，
//   见 muse.ts，绝不伪造。

import { z } from 'zod'
import type { Database } from 'bun:sqlite'
import { mkdirSync, rmSync, renameSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildSettingsText,
  assetRowToDomain,
  profileRowToDomain,
  settingsDomainToColumns,
  settingsRowToDomain,
  stateDefRowToDomain,
  EMPTY_SETTINGS,
  SETTINGS_FIELDS,
  nowIso,
  sha256Hex,
  uuidv7,
  type DbActivationRow,
  type DbAssetRow,
  type DbJobRow,
  type DbLinkRow,
  type DbProfileRow,
  type DbReferenceRow,
  type DbSettingsRow,
  type DbStateDefRow,
} from './schema'
import { insertSeedData, SEED_STATE_DEFS } from './seed'
import {
  clearAvatarUnavailable,
  generateAssetUnavailable,
  readLocalRuntimeBase,
  runtimeAssetsUnavailable,
  RUNTIME_BASE_MD5,
  type RuntimeBaseFile,
} from './muse'
import type {
  ActivationRecord,
  Asset,
  Capabilities,
  CharacterProfile,
  CharacterSettings,
  GenerationCandidate,
  ProfileDetail,
  StateSlot,
  StudioOverview,
} from '../../client/src/shared'

export interface ActionContext {
  db: Database
  projectRoot: string
  assetsDir: string
}

export class ActionError extends Error {}

function fail(message: string): never {
  throw new ActionError(message)
}

function parse<T>(schema: z.ZodType<T>, input: unknown, action: string): T {
  const result = schema.safeParse(input ?? {})
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    fail(`${action}：输入校验失败：${details}`)
  }
  return result.data
}

const idSchema = z.string().min(1)
const tagsSchema = z.array(z.string().min(1).max(30)).max(12).optional()

// ---- 线上能力矩阵（getCapabilities 实测原样，2026-11-26） ----
export const CAPABILITIES: Capabilities & {
  darkModeVariants: boolean
  notes: string[]
  runtimeAvatar: { label: string; md5: string; width: number; height: number; sourcePath: string; note: string }
  runtimeStates: Array<{ stateKey: string; name: string; kind: string }>
} = {
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
    md5: '2fb6bdc0c46ff85bdc77bc6285d26d9d',
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

// ---- 通用读 helpers ----

function getProfileRow(db: Database, id: string): DbProfileRow {
  const row = db.query('SELECT * FROM character_profiles WHERE id = ?').get(id) as DbProfileRow | null
  if (!row) fail(`角色卡不存在：${id}`)
  return row
}

function getSettingsRow(db: Database, profileId: string): DbSettingsRow {
  const row = db.query('SELECT * FROM character_settings WHERE profile_id = ?').get(profileId) as DbSettingsRow | null
  if (!row) fail(`角色卡 ${profileId} 没有设定记录`)
  return row
}

function getStateDefs(db: Database): DbStateDefRow[] {
  return db.query('SELECT * FROM state_definitions ORDER BY sort_order ASC').all() as DbStateDefRow[]
}

function getStateDefByKey(db: Database, stateKey: string): DbStateDefRow {
  const row = db.query('SELECT * FROM state_definitions WHERE state_key = ?').get(stateKey) as DbStateDefRow | null
  if (!row) fail(`状态定义不存在：${stateKey}`)
  return row
}

function getActiveProfileId(db: Database): string | null {
  const row = db.query("SELECT profile_id FROM active_profile WHERE scope = 'global'").get() as { profile_id: string | null } | null
  return row?.profile_id ?? null
}

function profileStats(db: Database, profileId: string): { assetCount: number; configuredStates: number; totalStates: number } {
  // assetCount：本卡拥有或已链入画廊的去重素材数（复制卡共享原卡素材时也计入）。
  const assetCount = (
    db.query(
      `SELECT COUNT(DISTINCT id) AS n FROM assets WHERE id IN (
        SELECT id FROM assets WHERE profile_id = ? AND status = 'asset'
        UNION SELECT asset_id FROM state_links WHERE profile_id = ?
      )`,
    ).get(profileId, profileId) as { n: number }
  ).n
  const defs = getStateDefs(db)
  const configurable = defs.filter((d) => d.configurable === 1)
  let configured = 0
  for (const d of configurable) {
    const sel = db.query('SELECT 1 AS x FROM state_links WHERE profile_id = ? AND state_key = ? AND is_selected = 1 LIMIT 1').get(profileId, d.state_key)
    if (sel) configured += 1
  }
  return { assetCount, configuredStates: configured, totalStates: configurable.length }
}

function coverUrlFor(db: Database, row: DbProfileRow): string | null {
  if (!row.cover_asset_id) return null
  const asset = db.query('SELECT * FROM assets WHERE id = ?').get(row.cover_asset_id) as DbAssetRow | null
  if (!asset) return null
  return `/assets/${asset.profile_id}/${asset.id}.${asset.format}`
}

function profileToDomain(db: Database, row: DbProfileRow): CharacterProfile {
  const stats = profileStats(db, row.id)
  return profileRowToDomain(row, {
    ...stats,
    isActive: getActiveProfileId(db) === row.id,
    coverUrl: coverUrlFor(db, row),
  })
}

function slotToDomain(db: Database, profileId: string, def: DbStateDefRow): StateSlot {
  const links = db.query('SELECT * FROM state_links WHERE profile_id = ? AND state_key = ? ORDER BY created_at ASC').all(profileId, def.state_key) as DbLinkRow[]
  const assets: StateSlot['assets'] = []
  let selectedAssetId: string | null = null
  for (const link of links) {
    const asset = db.query("SELECT * FROM assets WHERE id = ? AND status = 'asset'").get(link.asset_id) as DbAssetRow | null
    if (!asset) continue
    if (link.is_selected === 1) selectedAssetId = asset.id
    assets.push({ ...assetRowToDomain(asset, ''), linkId: link.id, isSelected: link.is_selected === 1 })
  }
  return { stateKey: def.state_key, selectedAssetId, assets }
}

function buildDetail(db: Database, profileId: string): ProfileDetail {
  const profileRow = getProfileRow(db, profileId)
  const settingsRow = db.query('SELECT * FROM character_settings WHERE profile_id = ?').get(profileId) as DbSettingsRow | null
  const settings = settingsRow ? settingsRowToDomain(settingsRow) : null
  const profile = profileToDomain(db, profileRow)
  const defs = getStateDefs(db)
  const slots = defs.map((d) => slotToDomain(db, profileId, d))
  const assetRows = db.query(
    `SELECT * FROM assets WHERE id IN (
      SELECT id FROM assets WHERE profile_id = ? AND status = 'asset'
      UNION SELECT asset_id FROM state_links WHERE profile_id = ?
    ) ORDER BY created_at ASC`,
  ).all(profileId, profileId) as DbAssetRow[]
  const assets = assetRows.map((a) => assetRowToDomain(a, ''))
  const candidateRows = db.query("SELECT * FROM assets WHERE profile_id = ? AND status = 'candidate' ORDER BY created_at ASC").all(profileId) as DbAssetRow[]
  const candidates: GenerationCandidate[] = candidateRows.map((a) => ({
    id: a.id,
    profileId: a.profile_id,
    stateKey: a.state_key ?? 'base',
    assetId: a.id,
    url: `/assets/${a.profile_id}/${a.id}.${a.format}`,
    prompt: a.prompt ?? '',
    status: 'candidate',
    createdAt: a.created_at,
  }))
  const refRows = db.query('SELECT * FROM asset_references WHERE profile_id = ? ORDER BY created_at ASC').all(profileId) as DbReferenceRow[]
  const references: Asset[] = []
  for (const r of refRows) {
    const asset = db.query("SELECT * FROM assets WHERE id = ? AND status = 'asset'").get(r.asset_id) as DbAssetRow | null
    if (asset) references.push(assetRowToDomain(asset, ''))
  }
  const jobRows = db.query('SELECT * FROM generation_jobs WHERE profile_id = ? ORDER BY created_at DESC LIMIT 30').all(profileId) as DbJobRow[]
  const jobs = jobRows.map((j) => ({ id: j.id, stateKey: j.state_key, status: j.status, createdAt: j.created_at }))
  const actRows = db.query('SELECT * FROM activations WHERE profile_id = ? ORDER BY activated_at DESC').all(profileId) as DbActivationRow[]
  const activations: ActivationRecord[] = actRows.map((a) => ({
    id: a.id,
    profileId: a.profile_id,
    activatedAt: a.activated_at,
    providerStatus: 'local_record',
    snapshotJson: a.snapshot_json,
  }))
  return {
    profile,
    settings,
    settingsText: settings ? buildSettingsText(profile, settings) : '',
    stateDefs: defs.map(stateDefRowToDomain),
    slots,
    assets,
    candidates,
    references,
    jobs,
    activations,
    isActive: getActiveProfileId(db) === profileId,
  }
}

// ---- 动作实现 ----

const getStudio = (ctx: ActionContext) => {
  const rows = ctx.db.query('SELECT * FROM character_profiles ORDER BY created_at ASC').all() as DbProfileRow[]
  const result: StudioOverview = {
    profiles: rows.map((r) => profileToDomain(ctx.db, r)),
    activeProfileId: getActiveProfileId(ctx.db),
    capabilities: CAPABILITIES,
  }
  return result
}

const getCapabilities = () => ({ capabilities: CAPABILITIES })

const seedStudio = (ctx: ActionContext) => {
  // 线上语义：已有任意 profile 时为 no-op，seeded=false。
  const before = (ctx.db.query('SELECT COUNT(*) AS n FROM character_profiles').get() as { n: number }).n
  insertSeedData(ctx.db)
  const existing = ctx.db.query('SELECT id FROM character_profiles ORDER BY created_at ASC').all() as Array<{ id: string }>
  return { seeded: before === 0, profileIds: existing.map((p) => p.id) }
}

const getProfileDetail = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'getProfileDetail')
  return buildDetail(ctx.db, id)
}

const createProfileSchema = z.object({
  name: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  tags: tagsSchema,
})

const createProfile = (ctx: ActionContext, input: unknown) => {
  const v = parse(createProfileSchema, input, 'createProfile')
  const now = nowIso()
  const id = uuidv7()
  const settingsId = uuidv7()
  ctx.db.run(
    'INSERT INTO character_profiles (id, name, subtitle, description, tags, favorite, cover_asset_id, settings_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, NULL, ?, ?)',
    [id, v.name, v.subtitle, v.description, JSON.stringify(v.tags ?? []), settingsId, now, now],
  )
  const cols = SETTINGS_FIELDS.map(() => '?').join(', ')
  const settingsCols = [
    'character_name', 'identity', 'origin', 'background', 'world_setting', 'relationship',
    'personality', 'temperament', 'values_text', 'strengths', 'weaknesses', 'emotional_traits',
    'quirks', 'speaking_style', 'tone', 'vocabulary', 'address_style', 'response_style',
    'catchphrases', 'forbidden_behaviors', 'appearance', 'hair', 'eyes', 'outfit',
    'accessories', 'body_features', 'color_palette', 'visual_style', 'consistency_rules',
    'generation_prompt', 'negative_prompt', 'composition_preferences', 'image_constraints',
  ].join(', ')
  ctx.db.run(
    `INSERT INTO character_settings (id, profile_id, ${settingsCols}, custom_fields, updated_at) VALUES (?, ?, ${cols}, '[]', ?)`,
    [settingsId, id, ...SETTINGS_FIELDS.map((f) => (f === 'characterName' ? v.name : EMPTY_SETTINGS[f])), now],
  )
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, id)) }
}

const updateProfile = (ctx: ActionContext, input: unknown) => {
  // 线上 schema 要求 name 必填；subtitle/description/tags 未传时保留原值
  // （不按 zod 默认清空，避免一次改名误删其他字段，见 BACKEND.md）。
  const v = parse(
    z.object({
      id: idSchema,
      name: z.string().min(1).max(80),
      subtitle: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      tags: tagsSchema,
    }),
    input,
    'updateProfile',
  )
  const row = getProfileRow(ctx.db, v.id)
  const next = {
    name: v.name,
    subtitle: v.subtitle ?? row.subtitle,
    description: v.description ?? row.description,
    tags: v.tags ?? (JSON.parse(row.tags) as string[]),
  }
  ctx.db.run('UPDATE character_profiles SET name = ?, subtitle = ?, description = ?, tags = ?, updated_at = ? WHERE id = ?', [
    next.name, next.subtitle, next.description, JSON.stringify(next.tags), nowIso(), v.id,
  ])
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, v.id)) }
}

const duplicateProfile = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'duplicateProfile')
  const src = getProfileRow(ctx.db, id)
  const srcSettings = getSettingsRow(ctx.db, id)
  const now = nowIso()
  const newId = uuidv7()
  const newSettingsId = uuidv7()
  ctx.db.run(
    'INSERT INTO character_profiles (id, name, subtitle, description, tags, favorite, cover_asset_id, settings_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
    [newId, src.name, src.subtitle, src.description, src.tags, src.favorite, src.cover_asset_id, newSettingsId, now, now],
  )
  const settings = settingsRowToDomain(srcSettings)
  const cols = settingsDomainToColumns(settings)
  const colNames = Object.keys(cols).join(', ')
  const placeholders = Object.keys(cols).map(() => '?').join(', ')
  ctx.db.run(
    `INSERT INTO character_settings (id, profile_id, ${colNames}, custom_fields, updated_at) VALUES (?, ?, ${placeholders}, ?, ?)`,
    [newSettingsId, newId, ...Object.values(cols), srcSettings.custom_fields, now],
  )
  // 画廊链接共享同一批素材文件（不复制文件），选中状态一并复制。
  const links = ctx.db.query('SELECT * FROM state_links WHERE profile_id = ?').all(id) as DbLinkRow[]
  for (const l of links) {
    ctx.db.run('INSERT INTO state_links (id, profile_id, state_key, asset_id, is_selected, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      uuidv7(), newId, l.state_key, l.asset_id, l.is_selected, now,
    ])
  }
  const refs = ctx.db.query('SELECT * FROM asset_references WHERE profile_id = ?').all(id) as DbReferenceRow[]
  for (const r of refs) {
    ctx.db.run('INSERT OR IGNORE INTO asset_references (id, profile_id, asset_id, kind, created_at) VALUES (?, ?, ?, ?, ?)', [
      uuidv7(), newId, r.asset_id, r.kind, now,
    ])
  }
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, newId)) }
}

const toggleFavorite = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'toggleFavorite')
  const row = getProfileRow(ctx.db, id)
  ctx.db.run('UPDATE character_profiles SET favorite = ?, updated_at = ? WHERE id = ?', [row.favorite === 1 ? 0 : 1, nowIso(), id])
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, id)) }
}

const archiveProfile = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'archiveProfile')
  if (getActiveProfileId(ctx.db) === id) fail('archiveProfile：该角色卡当前已激活，须先解除激活才能归档')
  getProfileRow(ctx.db, id)
  ctx.db.run('UPDATE character_profiles SET archived_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), id])
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, id)) }
}

const restoreProfile = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'restoreProfile')
  getProfileRow(ctx.db, id)
  ctx.db.run('UPDATE character_profiles SET archived_at = NULL, updated_at = ? WHERE id = ?', [nowIso(), id])
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, id)) }
}

const deleteProfile = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'deleteProfile')
  if (getActiveProfileId(ctx.db) === id) fail('deleteProfile：该角色卡当前已激活，须先解除激活才能删除')
  const row = getProfileRow(ctx.db, id)
  void row
  const assets = ctx.db.query('SELECT * FROM assets WHERE profile_id = ?').all(id) as DbAssetRow[]
  for (const a of assets) {
    const file = join(ctx.assetsDir, a.profile_id, `${a.id}.${a.format}`)
    try {
      if (existsSync(file)) rmSync(file)
    } catch {
      // 文件删不掉不阻塞删卡，见 BACKEND.md。
    }
  }
  ctx.db.run('DELETE FROM assets WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM state_links WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM character_settings WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM generation_jobs WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM activations WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM asset_references WHERE profile_id = ?', [id])
  ctx.db.run('DELETE FROM character_profiles WHERE id = ?', [id])
  return { deleted: true }
}

// ---- 设定 ----

const settingsObjectSchema = (() => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of SETTINGS_FIELDS) shape[f] = z.string().max(4000)
  shape.customFields = z.array(z.object({ key: z.string().min(1).max(60), value: z.string().max(4000) })).max(40)
  return z.object(shape)
})()

const saveSettings = (ctx: ActionContext, input: unknown) => {
  const raw = (input ?? {}) as Record<string, unknown>
  const profileId = typeof raw.profileId === 'string' ? raw.profileId : ''
  if (!profileId) fail('saveSettings：profileId 必填')
  const existing = getSettingsRow(ctx.db, profileId)
  const current = settingsRowToDomain(existing)
  let merged: CharacterSettings
  if (raw.settings !== undefined) {
    // 线上形状：全量 settings 对象，32 字段 + customFields 全部必填。
    const full = parse(settingsObjectSchema, raw.settings, 'saveSettings.settings')
    merged = { ...current, ...full, id: current.id, profileId }
  } else if (raw.patch !== undefined) {
    // 本地前端形状：patch 部分字段，合并后保存。
    const patchShape: Record<string, z.ZodTypeAny> = {}
    for (const f of SETTINGS_FIELDS) patchShape[f] = z.string().max(4000).optional()
    patchShape.customFields = z.array(z.object({ key: z.string().min(1).max(60), value: z.string().max(4000) })).max(40).optional()
    const patch = parse(z.object(patchShape), raw.patch, 'saveSettings.patch')
    merged = { ...current, ...patch, id: current.id, profileId }
  } else {
    fail('saveSettings：需要 settings（全量）或 patch（部分字段）')
  }
  const cols = settingsDomainToColumns(merged)
  const assignments = Object.keys(cols).map((c) => `${c} = ?`).join(', ')
  ctx.db.run(`UPDATE character_settings SET ${assignments}, custom_fields = ?, updated_at = ? WHERE profile_id = ?`, [
    ...Object.values(cols),
    JSON.stringify(merged.customFields),
    nowIso(),
    profileId,
  ])
  const settings = settingsRowToDomain(getSettingsRow(ctx.db, profileId))
  const profile = getProfileRow(ctx.db, profileId)
  return { settings, settingsText: buildSettingsText(profile, settings) }
}

// ---- 状态定义 ----

const addStateDefinition = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({
      stateKey: z.string().max(40).regex(/^[a-z0-9_]+$/),
      name: z.string().min(1).max(40),
      description: z.string().max(500).optional().default(''),
    }),
    input,
    'addStateDefinition',
  )
  const dup = ctx.db.query('SELECT 1 AS x FROM state_definitions WHERE state_key = ?').get(v.stateKey)
  if (dup) fail(`addStateDefinition：stateKey 已存在：${v.stateKey}`)
  const maxSort = (ctx.db.query('SELECT MAX(sort_order) AS m FROM state_definitions').get() as { m: number | null }).m ?? -1
  const id = uuidv7()
  ctx.db.run('INSERT INTO state_definitions (id, state_key, name, description, required, configurable, runtime_state_key, sort_order) VALUES (?, ?, ?, ?, 0, 0, NULL, ?)', [
    id, v.stateKey, v.name, v.description, maxSort + 1,
  ])
  const row = ctx.db.query('SELECT * FROM state_definitions WHERE id = ?').get(id) as DbStateDefRow
  return { definition: stateDefRowToDomain(row) }
}

const updateStateDefinition = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({
      id: idSchema,
      name: z.string().min(1).max(40),
      description: z.string().max(500),
      required: z.boolean(),
      sortOrder: z.number().int().min(0).max(999),
    }),
    input,
    'updateStateDefinition',
  )
  const row = ctx.db.query('SELECT * FROM state_definitions WHERE id = ?').get(v.id) as DbStateDefRow | null
  if (!row) fail(`状态定义不存在：${v.id}`)
  ctx.db.run('UPDATE state_definitions SET name = ?, description = ?, required = ?, sort_order = ? WHERE id = ?', [
    v.name, v.description, v.required ? 1 : 0, v.sortOrder, v.id,
  ])
  const updated = ctx.db.query('SELECT * FROM state_definitions WHERE id = ?').get(v.id) as DbStateDefRow
  return { definition: stateDefRowToDomain(updated) }
}

const deleteStateDefinition = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'deleteStateDefinition')
  const row = ctx.db.query('SELECT * FROM state_definitions WHERE id = ?').get(id) as DbStateDefRow | null
  if (!row) fail(`状态定义不存在：${id}`)
  if (row.state_key === 'base') fail('deleteStateDefinition：基础形象（base）不可删除')
  if (SEED_STATE_DEFS.some((d) => d.stateKey === row.state_key)) {
    fail(`deleteStateDefinition：${row.state_key} 是内置状态定义，只能删除后加的自定义状态定义`)
  }
  ctx.db.run('DELETE FROM state_links WHERE state_key = ?', [row.state_key])
  ctx.db.run('DELETE FROM state_definitions WHERE id = ?', [id])
  return { deleted: true }
}

// ---- 素材 ----

const MIME_TO_FORMAT: Record<string, { format: string; mediaType: 'image' | 'video' }> = {
  'image/png': { format: 'png', mediaType: 'image' },
  'image/jpeg': { format: 'jpg', mediaType: 'image' },
  'image/webp': { format: 'webp', mediaType: 'image' },
  'image/gif': { format: 'gif', mediaType: 'image' },
  'video/mp4': { format: 'mp4', mediaType: 'video' },
  'video/webm': { format: 'webm', mediaType: 'video' },
}

function imageDimensions(bytes: Uint8Array, format: string): { width: number | null; height: number | null } {
  try {
    if (format === 'png' && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      return { width: view.getUint32(16), height: view.getUint32(20) }
    }
    if (format === 'gif' && bytes.length >= 10) {
      return { width: bytes[6]! | (bytes[7]! << 8), height: bytes[8]! | (bytes[9]! << 8) }
    }
    if (format === 'webp' && bytes.length >= 30) {
      const tag = String.fromCharCode(...bytes.slice(12, 16))
      if (tag === 'VP8X') {
        const w = (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1
        const h = (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1
        return { width: w, height: h }
      }
      if (tag === 'VP8 ') {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
      }
      if (tag === 'VP8L') {
        const w = ((bytes[21]! | ((bytes[22]! & 0x3f) << 8)) + 1)
        const h = ((bytes[23]! | ((bytes[24]! & 0x3f) << 8)) + 1)
        return { width: w, height: h }
      }
    }
  } catch {
    // 尺寸解析失败不阻塞上传，宽高留空。
  }
  return { width: null, height: null }
}

function storeAssetFile(ctx: ActionContext, profileId: string, assetId: string, format: string, bytes: Uint8Array): string {
  const dir = join(ctx.assetsDir, profileId)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${assetId}.${format}`)
  const tmpPath = `${filePath}.tmp-${uuidv7()}`
  writeFileSync(tmpPath, bytes)
  renameSync(tmpPath, filePath)
  return `assets/${profileId}/${assetId}.${format}`
}

function linkAsset(ctx: ActionContext, profileId: string, stateKey: string, assetId: string, select: boolean): StateSlot {
  getStateDefByKey(ctx.db, stateKey)
  const existing = ctx.db.query('SELECT * FROM state_links WHERE profile_id = ? AND state_key = ? AND asset_id = ?').get(profileId, stateKey, assetId) as DbLinkRow | null
  if (!existing) {
    ctx.db.run('INSERT INTO state_links (id, profile_id, state_key, asset_id, is_selected, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      uuidv7(), profileId, stateKey, assetId, select ? 1 : 0, nowIso(),
    ])
  } else if (select) {
    ctx.db.run('UPDATE state_links SET is_selected = 1 WHERE id = ?', [existing.id])
  }
  if (select) {
    ctx.db.run('UPDATE state_links SET is_selected = 0 WHERE profile_id = ? AND state_key = ? AND asset_id != ?', [profileId, stateKey, assetId])
  }
  const def = getStateDefByKey(ctx.db, stateKey)
  return slotToDomain(ctx.db, profileId, def)
}

const uploadAsset = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({
      profileId: idSchema,
      dataBase64: z.string().min(1).max(28_000_000),
      mimeType: z.string().min(1).max(80),
      note: z.string().max(500).optional().default(''),
      select: z.boolean().optional().default(false),
      source: z.enum(['upload', 'imported']).optional().default('upload'),
      stateKey: z.string().max(40).nullable().optional().default(null),
    }),
    input,
    'uploadAsset',
  )
  getProfileRow(ctx.db, v.profileId)
  const mapped = MIME_TO_FORMAT[v.mimeType]
  if (!mapped) fail(`uploadAsset：不支持的文件类型：${v.mimeType}（仅 png/jpeg/webp/gif/mp4/webm）`)
  if (v.select && !v.stateKey) fail('uploadAsset：select=true 时必须指定 stateKey')
  if (v.stateKey) getStateDefByKey(ctx.db, v.stateKey)
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(v.dataBase64)) fail('uploadAsset：dataBase64 不是合法的 base64')
  const bytes = new Uint8Array(Buffer.from(v.dataBase64, 'base64'))
  if (bytes.length === 0) fail('uploadAsset：文件内容为空')
  const sha256 = sha256Hex(bytes)
  const dims = imageDimensions(bytes, mapped.format)
  const assetId = uuidv7()
  // 文件名与数据库行共用同一个 assetId。
  storeAssetFile(ctx, v.profileId, assetId, mapped.format, bytes)
  const row = insertAssetRowWithId(ctx, assetId, {
    profileId: v.profileId,
    mediaType: mapped.mediaType,
    format: mapped.format,
    filePath: `assets/${v.profileId}/${assetId}.${mapped.format}`,
    width: dims.width,
    height: dims.height,
    fileSize: bytes.length,
    sha256,
    source: v.source,
    prompt: null,
    note: v.note || null,
    status: 'asset',
    stateKey: v.stateKey,
  })
  let slot: StateSlot | undefined
  if (v.stateKey) slot = linkAsset(ctx, v.profileId, v.stateKey, assetId, v.select)
  return { asset: assetRowToDomain(row, ''), ...(slot ? { slot } : {}) }
}

function insertAssetRowWithId(
  ctx: ActionContext,
  id: string,
  v: {
    profileId: string
    mediaType: 'image' | 'video'
    format: string
    filePath: string
    width: number | null
    height: number | null
    fileSize: number
    sha256: string
    source: 'upload' | 'imported'
    prompt: string | null
    note: string | null
    status: 'asset' | 'candidate'
    stateKey: string | null
  },
): DbAssetRow {
  const now = nowIso()
  ctx.db.run(
    "INSERT INTO assets (id, profile_id, media_type, format, file_path, thumbnail_path, width, height, file_size, sha256, source, prompt, note, status, state_key, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, v.profileId, v.mediaType, v.format, v.filePath, v.width, v.height, v.fileSize, v.sha256, v.source, v.prompt, v.note, v.status, v.stateKey, now],
  )
  return ctx.db.query('SELECT * FROM assets WHERE id = ?').get(id) as DbAssetRow
}

const selectStateAsset = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({ profileId: idSchema, stateKey: z.string().min(1).max(40), assetId: idSchema }),
    input,
    'selectStateAsset',
  )
  const asset = getAssetUsableBy(ctx, v.assetId, v.profileId)
  if (asset.status !== 'asset') fail('selectStateAsset：候选素材须先采纳（adoptCandidate）才能被选中')
  return { slot: linkAsset(ctx, v.profileId, v.stateKey, v.assetId, true) }
}

const linkAssetToState = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({ profileId: idSchema, stateKey: z.string().min(1).max(40), assetId: idSchema }),
    input,
    'linkAssetToState',
  )
  const asset = getAssetUsableBy(ctx, v.assetId, v.profileId)
  if (asset.status !== 'asset') fail('linkAssetToState：候选素材须先采纳（adoptCandidate）才能链入画廊')
  return { slot: linkAsset(ctx, v.profileId, v.stateKey, v.assetId, false) }
}

const unlinkStateAsset = (ctx: ActionContext, input: unknown) => {
  const { linkId } = parse(z.object({ linkId: idSchema }), input, 'unlinkStateAsset')
  const link = ctx.db.query('SELECT * FROM state_links WHERE id = ?').get(linkId) as DbLinkRow | null
  if (!link) fail(`unlinkStateAsset：链接不存在：${linkId}`)
  ctx.db.run('DELETE FROM state_links WHERE id = ?', [linkId])
  const def = getStateDefByKey(ctx.db, link.state_key)
  return { deleted: true, slot: slotToDomain(ctx.db, link.profile_id, def) }
}

function getAssetRow(ctx: ActionContext, assetId: string, profileId?: string): DbAssetRow {
  const row = ctx.db.query('SELECT * FROM assets WHERE id = ?').get(assetId) as DbAssetRow | null
  if (!row) fail(`素材不存在：${assetId}`)
  if (profileId && row.profile_id !== profileId) fail(`素材 ${assetId} 不属于角色卡 ${profileId}`)
  return row
}

/**
 * 复制卡共享原卡素材（不复制文件）时，素材行仍属于原卡，但复制卡
 * 可以选用、链入、设为封面或参考。可用条件：属于本卡，或已链入本卡画廊。
 */
function getAssetUsableBy(ctx: ActionContext, assetId: string, profileId: string): DbAssetRow {
  const row = ctx.db.query('SELECT * FROM assets WHERE id = ?').get(assetId) as DbAssetRow | null
  if (!row) fail(`素材不存在：${assetId}`)
  if (row.profile_id === profileId) return row
  const linked = ctx.db.query('SELECT 1 AS x FROM state_links WHERE profile_id = ? AND asset_id = ? LIMIT 1').get(profileId, assetId)
  if (linked) return row
  fail(`素材 ${assetId} 不属于角色卡 ${profileId}，也未链入其画廊`)
}

const deleteAsset = (ctx: ActionContext, input: unknown) => {
  const v = parse(z.object({ assetId: idSchema, profileId: z.string().min(1).optional() }), input, 'deleteAsset')
  // 共享素材：拥有者或链入该素材的卡都可以删；删的是文件与全部链接。
  const asset = getAssetRow(ctx, v.assetId)
  if (v.profileId && asset.profile_id !== v.profileId) {
    const linked = ctx.db.query('SELECT 1 AS x FROM state_links WHERE profile_id = ? AND asset_id = ? LIMIT 1').get(v.profileId, v.assetId)
    if (!linked) fail(`素材 ${v.assetId} 不属于角色卡 ${v.profileId}，也未链入其画廊`)
  }
  const selected = ctx.db.query('SELECT 1 AS x FROM state_links WHERE asset_id = ? AND is_selected = 1 LIMIT 1').get(v.assetId)
  if (selected) fail('deleteAsset：该素材正被某个状态槽位选中，须先取消选中或换选其他素材')
  const file = join(ctx.assetsDir, asset.profile_id, `${asset.id}.${asset.format}`)
  try {
    if (existsSync(file)) rmSync(file)
  } catch {
    // 文件删不掉不阻塞删记录，见 BACKEND.md。
  }
  ctx.db.run('DELETE FROM state_links WHERE asset_id = ?', [v.assetId])
  ctx.db.run('DELETE FROM asset_references WHERE asset_id = ?', [v.assetId])
  ctx.db.run('DELETE FROM assets WHERE id = ?', [v.assetId])
  return { deleted: true }
}

const setCover = (ctx: ActionContext, input: unknown) => {
  const v = parse(z.object({ profileId: idSchema, assetId: z.string().min(1).nullable() }), input, 'setCover')
  getProfileRow(ctx.db, v.profileId)
  if (v.assetId) getAssetUsableBy(ctx, v.assetId, v.profileId)
  ctx.db.run('UPDATE character_profiles SET cover_asset_id = ?, updated_at = ? WHERE id = ?', [v.assetId, nowIso(), v.profileId])
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, v.profileId)) }
}

const setReference = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({ profileId: idSchema, assetId: idSchema, kind: z.enum(['appearance', 'style']) }),
    input,
    'setReference',
  )
  getAssetUsableBy(ctx, v.assetId, v.profileId)
  const existing = ctx.db.query('SELECT * FROM asset_references WHERE profile_id = ? AND asset_id = ? AND kind = ?').get(v.profileId, v.assetId, v.kind) as DbReferenceRow | null
  if (existing) {
    return { reference: { id: existing.id, profileId: existing.profile_id, assetId: existing.asset_id, kind: existing.kind, createdAt: existing.created_at } }
  }
  const id = uuidv7()
  const now = nowIso()
  ctx.db.run('INSERT INTO asset_references (id, profile_id, asset_id, kind, created_at) VALUES (?, ?, ?, ?, ?)', [id, v.profileId, v.assetId, v.kind, now])
  return { reference: { id, profileId: v.profileId, assetId: v.assetId, kind: v.kind, createdAt: now } }
}

const removeReference = (ctx: ActionContext, input: unknown) => {
  const { id } = parse(z.object({ id: idSchema }), input, 'removeReference')
  const row = ctx.db.query('SELECT * FROM asset_references WHERE id = ?').get(id) as DbReferenceRow | null
  if (!row) fail(`removeReference：参考标记不存在：${id}`)
  ctx.db.run('DELETE FROM asset_references WHERE id = ?', [id])
  return { deleted: true }
}

// ---- 生成（依托 Muse，本地明确报错） ----

const generateAsset = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({
      profileId: idSchema,
      stateKey: z.string().min(1).max(40),
      stateBrief: z.string().max(1000).optional().default(''),
      extra: z.string().max(1000).optional().default(''),
    }),
    input,
    'generateAsset',
  )
  getProfileRow(ctx.db, v.profileId)
  getStateDefByKey(ctx.db, v.stateKey)
  // 先把这次失败的尝试记成一条任务，再报错：用户能在生成中心看到它失败过，
  // 而不是假装生成了一张图。
  const jobId = uuidv7()
  const message =
    'generateAsset 需要 Muse 的 generate_media 才能生成图片；本地后端无法调用 Muse，也不会生成假图。' +
    '替代做法：在 Muse 线上工作室里生成候选，或先用 uploadAsset 上传一张真实图片。'
  ctx.db.run('INSERT INTO generation_jobs (id, profile_id, state_key, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    jobId, v.profileId, v.stateKey, 'error', message, nowIso(),
  ])
  void v.stateBrief
  void v.extra
  generateAssetUnavailable()
}

// ---- 候选 ----

function candidateIdFrom(input: Record<string, unknown>): string {
  const id = (input.assetId as string | undefined) ?? (input.candidateId as string | undefined)
  if (!id) fail('需要 assetId（或兼容别名 candidateId）')
  return id
}

const adoptCandidate = (ctx: ActionContext, input: unknown) => {
  const raw = (input ?? {}) as Record<string, unknown>
  const v = parse(
    z.object({
      profileId: idSchema,
      stateKey: z.string().min(1).max(40),
      select: z.boolean().optional().default(true),
    }),
    raw,
    'adoptCandidate',
  )
  const assetId = candidateIdFrom(raw)
  const asset = getAssetRow(ctx, assetId, v.profileId)
  if (asset.status !== 'candidate') fail('adoptCandidate：该素材不是候选（status 不是 candidate），无需采纳')
  ctx.db.run("UPDATE assets SET status = 'asset' WHERE id = ?", [assetId])
  const slot = linkAsset(ctx, v.profileId, v.stateKey, assetId, v.select)
  const updated = getAssetRow(ctx, assetId, v.profileId)
  return { asset: assetRowToDomain(updated, ''), slot }
}

const discardCandidate = (ctx: ActionContext, input: unknown) => {
  const raw = (input ?? {}) as Record<string, unknown>
  const assetId = candidateIdFrom(raw)
  const asset = getAssetRow(ctx, assetId)
  if (asset.status !== 'candidate') fail('discardCandidate：该素材不是候选（status 不是 candidate）')
  const file = join(ctx.assetsDir, asset.profile_id, `${asset.id}.${asset.format}`)
  try {
    if (existsSync(file)) rmSync(file)
  } catch {
    // 文件删不掉不阻塞删记录。
  }
  ctx.db.run('DELETE FROM state_links WHERE asset_id = ?', [assetId])
  ctx.db.run('DELETE FROM assets WHERE id = ?', [assetId])
  return { discarded: true }
}

// ---- 激活 ----

const activateProfile = (ctx: ActionContext, input: unknown) => {
  const v = parse(
    z.object({ profileId: idSchema, note: z.string().max(500).optional().default('') }),
    input,
    'activateProfile',
  )
  const profileRow = getProfileRow(ctx.db, v.profileId)
  if (profileRow.archived_at) fail('activateProfile：该角色卡已归档，须先恢复才能激活')
  const detail = buildDetail(ctx.db, v.profileId)
  const baseSlot = detail.slots.find((s) => s.stateKey === 'base')
  const baseAssetId = baseSlot?.selectedAssetId ?? null
  if (!baseAssetId) fail('activateProfile：基础形象（base）槽位没有选中素材，须先上传或选择一张基础形象素材')
  const baseAsset = getAssetRow(ctx, baseAssetId, v.profileId)
  const stateSelections: Record<string, string | null> = {}
  for (const s of detail.slots) stateSelections[s.stateKey] = s.selectedAssetId
  const snapshot = {
    mode: 'shared_base',
    baseAssetId,
    baseAssetSha256: baseAsset.sha256,
    stateSelections,
    settingsText: detail.settingsText,
    note: v.note || undefined,
  }
  const activationId = uuidv7()
  const activatedAt = nowIso()
  ctx.db.run('INSERT INTO activations (id, profile_id, activated_at, provider_status, snapshot_json) VALUES (?, ?, ?, ?, ?)', [
    activationId, v.profileId, activatedAt, 'local_record', JSON.stringify(snapshot),
  ])
  ctx.db.run("INSERT INTO active_profile (scope, profile_id) VALUES ('global', ?) ON CONFLICT(scope) DO UPDATE SET profile_id = excluded.profile_id", [v.profileId])
  const activation: ActivationRecord = {
    id: activationId,
    profileId: v.profileId,
    activatedAt,
    providerStatus: 'local_record',
    snapshotJson: JSON.stringify(snapshot),
  }
  return { activation, activeProfileId: v.profileId }
}

const deactivateProfile = (ctx: ActionContext) => {
  ctx.db.run("DELETE FROM active_profile WHERE scope = 'global'")
  return { activeProfileId: null }
}

// ---- 导入 / 导出 ----

const exportProfile = (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'exportProfile')
  const detail = buildDetail(ctx.db, profileId)
  const settings = detail.settings
  if (!settings) fail(`exportProfile：角色卡 ${profileId} 没有设定记录`)
  const doc = {
    format: 'muse-character-studio/profile@1',
    exportedAt: nowIso(),
    profile: {
      id: detail.profile.id,
      name: detail.profile.name,
      subtitle: detail.profile.subtitle,
      description: detail.profile.description,
      tags: detail.profile.tags,
      favorite: detail.profile.favorite,
    },
    settings: { ...settings },
    settingsText: detail.settingsText,
    stateDefinitions: detail.stateDefs.map((d) => ({ stateKey: d.stateKey, name: d.name, description: d.description })),
    gallery: detail.slots.map((s) => ({ stateKey: s.stateKey, selectedAssetId: s.selectedAssetId, assetIds: s.assets.map((a) => a.id) })),
    assets: detail.assets.map((a) => ({ id: a.id, sha256: a.sha256, format: a.format, source: a.source })),
    note: '素材文件字节未包含在此导出中；asset id 与 sha256 用于核对。',
  }
  return { json: JSON.stringify(doc, null, 2) }
}

const importProfile = (ctx: ActionContext, input: unknown) => {
  const raw = (input ?? {}) as Record<string, unknown>
  let doc: Record<string, unknown>
  if (typeof raw.json === 'string') {
    try {
      doc = JSON.parse(raw.json) as Record<string, unknown>
    } catch {
      fail('importProfile：json 解析失败')
    }
  } else if (typeof raw.profileJson === 'string' || typeof raw.settingsJson === 'string') {
    // 本地旧别名形状：profileJson + settingsJson，拼成同一份文档。
    const profilePart = typeof raw.profileJson === 'string' ? JSON.parse(raw.profileJson) as Record<string, unknown> : {}
    const settingsPart = typeof raw.settingsJson === 'string' ? JSON.parse(raw.settingsJson) as Record<string, unknown> : {}
    doc = { format: 'muse-character-studio/profile@1', profile: profilePart, settings: settingsPart }
  } else {
    fail('importProfile：需要 json（线上导出格式）')
  }
  if (doc.format !== 'muse-character-studio/profile@1') fail('importProfile：不是 Muse Character Studio 的导出文件（format 不符）')
  const exportedProfile = doc.profile as Record<string, unknown> | undefined
  const exportedSettings = doc.settings as Record<string, unknown> | undefined
  if (!exportedProfile || typeof exportedProfile.name !== 'string' || !exportedProfile.name) {
    fail('importProfile：导出文件里没有有效的 profile')
  }
  const now = nowIso()
  const id = typeof exportedProfile.id === 'string' && !ctx.db.query('SELECT 1 AS x FROM character_profiles WHERE id = ?').get(exportedProfile.id)
    ? (exportedProfile.id as string)
    : uuidv7()
  const settingsId = uuidv7()
  const tags = Array.isArray(exportedProfile.tags) ? (exportedProfile.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 12) : []
  ctx.db.run(
    'INSERT INTO character_profiles (id, name, subtitle, description, tags, favorite, cover_asset_id, settings_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)',
    [
      id,
      (exportedProfile.name as string).slice(0, 80),
      typeof exportedProfile.subtitle === 'string' ? exportedProfile.subtitle.slice(0, 120) : '',
      typeof exportedProfile.description === 'string' ? exportedProfile.description.slice(0, 2000) : '',
      JSON.stringify(tags),
      exportedProfile.favorite === true ? 1 : 0,
      settingsId,
      now,
      now,
    ],
  )
  const settings: Record<string, string> = { ...EMPTY_SETTINGS }
  if (exportedSettings) {
    for (const f of SETTINGS_FIELDS) {
      if (typeof exportedSettings[f] === 'string') settings[f] = (exportedSettings[f] as string).slice(0, 4000)
    }
  }
  const settingsCols = settingsDomainToColumns(settings)
  const colNames = Object.keys(settingsCols).join(', ')
  const placeholders = Object.keys(settingsCols).map(() => '?').join(', ')
  const customFields = Array.isArray(exportedSettings?.customFields)
    ? ((exportedSettings.customFields as unknown[]).filter((c) => c && typeof c === 'object').slice(0, 40) as Array<{ key: string; value: string }>)
    : []
  ctx.db.run(
    `INSERT INTO character_settings (id, profile_id, ${colNames}, custom_fields, updated_at) VALUES (?, ?, ${placeholders}, ?, ?)`,
    [settingsId, id, ...Object.values(settingsCols), JSON.stringify(customFields), now],
  )
  // 导出里列出的状态定义：缺失的按 stateKey 补建（不覆盖已有定义）；
  // 画廊与素材文件不恢复（线上同款规则）。
  if (Array.isArray(doc.stateDefinitions)) {
    const maxSort = (ctx.db.query('SELECT MAX(sort_order) AS m FROM state_definitions').get() as { m: number | null }).m ?? -1
    let nextSort = maxSort + 1
    for (const d of doc.stateDefinitions as Array<Record<string, unknown>>) {
      if (typeof d.stateKey !== 'string' || typeof d.name !== 'string') continue
      ctx.db.run('INSERT OR IGNORE INTO state_definitions (id, state_key, name, description, required, configurable, runtime_state_key, sort_order) VALUES (?, ?, ?, ?, 0, 0, NULL, ?)', [
        uuidv7(), d.stateKey, d.name.slice(0, 40), typeof d.description === 'string' ? d.description.slice(0, 500) : '', nextSort,
      ])
      nextSort += 1
    }
  }
  return { profile: profileToDomain(ctx.db, getProfileRow(ctx.db, id)) }
}

// ---- 本地兼容别名（线上不发布，见 BACKEND.md） ----

const getSettingsText = (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'getSettingsText')
  const detail = buildDetail(ctx.db, profileId)
  return { settingsText: detail.settingsText }
}

const listActivations = (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'listActivations')
  const detail = buildDetail(ctx.db, profileId)
  return { activations: detail.activations }
}

const listGenerationJobs = (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'listGenerationJobs')
  const detail = buildDetail(ctx.db, profileId)
  return { jobs: detail.jobs }
}

const getRuntimeAssets = () => runtimeAssetsUnavailable()

const clearAvatar = () => {
  clearAvatarUnavailable()
}

const verifyAssetIntegrity = (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'verifyAssetIntegrity')
  getProfileRow(ctx.db, profileId)
  const assets = ctx.db.query(
    `SELECT * FROM assets WHERE id IN (
      SELECT id FROM assets WHERE profile_id = ?
      UNION SELECT asset_id FROM state_links WHERE profile_id = ?
    )`,
  ).all(profileId, profileId) as DbAssetRow[]
  const mismatched: string[] = []
  for (const a of assets) {
    const file = join(ctx.assetsDir, a.profile_id, `${a.id}.${a.format}`)
    if (!existsSync(file)) {
      mismatched.push(a.id)
      continue
    }
    const data = new Uint8Array(readFileSync(file))
    if (a.sha256 && sha256Hex(data) !== a.sha256) mismatched.push(a.id)
  }
  return { checked: assets.length, mismatched }
}

const importRuntimeBase = async (ctx: ActionContext, input: unknown) => {
  const { profileId } = parse(z.object({ profileId: idSchema }), input, 'importRuntimeBase')
  getProfileRow(ctx.db, profileId)
  const found: RuntimeBaseFile = await readLocalRuntimeBase(ctx.projectRoot)
  const sha256 = sha256Hex(found.bytes)
  const md5 = new Bun.CryptoHasher('md5').update(found.bytes).digest('hex')
  const existing = ctx.db.query('SELECT * FROM assets WHERE profile_id = ? AND sha256 = ? AND status = ?').get(profileId, sha256, 'asset') as DbAssetRow | null
  if (existing) {
    const slot = linkAsset(ctx, profileId, 'base', existing.id, true)
    return { asset: assetRowToDomain(existing, ''), alreadyPresent: true, slot, warning: md5 === RUNTIME_BASE_MD5 ? undefined : `MD5 ${md5} 与已验证原图 ${RUNTIME_BASE_MD5} 不一致，这张可能不是 v1 原图` }
  }
  const dims = imageDimensions(found.bytes, 'webp')
  const assetId = uuidv7()
  storeAssetFile(ctx, profileId, assetId, 'webp', found.bytes)
  const row = insertAssetRowWithId(ctx, assetId, {
    profileId,
    mediaType: 'image',
    format: 'webp',
    filePath: `assets/${profileId}/${assetId}.webp`,
    width: dims.width,
    height: dims.height,
    fileSize: found.bytes.length,
    sha256,
    source: 'imported',
    prompt: null,
    note: `运行时原图导入 · MD5 ${md5}${md5 === RUNTIME_BASE_MD5 ? '（已验证 v1 原图）' : '（与已验证原图 MD5 不一致）'}`,
    status: 'asset',
    stateKey: 'base',
  })
  const slot = linkAsset(ctx, profileId, 'base', assetId, true)
  return { asset: assetRowToDomain(row, ''), alreadyPresent: false, slot }
}

// ---- 分发表 ----

export type ActionHandler = (ctx: ActionContext, input: unknown) => unknown | Promise<unknown>

/** 线上真实发布的 30 个动作。 */
export const REAL_ACTIONS: Record<string, ActionHandler> = {
  getStudio: (ctx) => getStudio(ctx),
  getProfileDetail,
  getCapabilities: () => getCapabilities(),
  seedStudio: (ctx) => seedStudio(ctx),
  createProfile,
  updateProfile,
  duplicateProfile,
  archiveProfile,
  restoreProfile,
  deleteProfile,
  toggleFavorite,
  saveSettings,
  uploadAsset,
  selectStateAsset,
  linkAssetToState,
  unlinkStateAsset,
  deleteAsset,
  setCover,
  setReference,
  removeReference,
  generateAsset,
  adoptCandidate,
  discardCandidate,
  activateProfile,
  deactivateProfile,
  exportProfile,
  importProfile,
  addStateDefinition,
  updateStateDefinition,
  deleteStateDefinition,
}

/**
 * 本地兼容别名：线上不发布，仅为本地前端（api.ts）与旧调用形状服务。
 * - selectAsset → selectStateAsset
 * - deleteCandidate → discardCandidate（入参 candidateId）
 * - getSettingsText / listActivations / listGenerationJobs：只读派生查询
 * - importRuntimeBase：本地原图导入（线上对应流程是 uploadAsset source='imported'）
 * - getRuntimeAssets / clearAvatar / verifyAssetIntegrity：见 muse.ts / 本地校验
 */
export const LOCAL_ALIASES: Record<string, ActionHandler> = {
  selectAsset: selectStateAsset,
  deleteCandidate: discardCandidate,
  getSettingsText,
  listActivations,
  listGenerationJobs,
  getRuntimeAssets: () => getRuntimeAssets(),
  clearAvatar: () => clearAvatar(),
  importRuntimeBase,
  verifyAssetIntegrity,
}

export const ACTIONS: Record<string, ActionHandler> = { ...REAL_ACTIONS, ...LOCAL_ALIASES }

export function dispatchAction(ctx: ActionContext, action: string, input: unknown): unknown | Promise<unknown> {
  const handler = ACTIONS[action]
  if (!handler) fail(`未知动作：${action}（线上发布的 30 个动作见 BACKEND.md）`)
  return handler(ctx, input)
}
