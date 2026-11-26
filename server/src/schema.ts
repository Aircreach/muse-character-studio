// server/src/schema.ts — 本地后端的数据模型与 SQLite 层。
//
// 还原目标：线上 Muse Character Studio 的后端模型（Drizzle，30 个动作）。
// 线上源码不在本地仓库里，这里的表结构是按线上动作的请求/响应 schema
// 与 getProfileDetail / getStudio / exportProfile 的实测返回形状重建的，
// 字段与线上返回一致；凡是无法从线上验证的细节，都在 BACKEND.md 里标明。
//
// 持久化：Bun 内置 sqlite，单文件 server/data/studio.db（gitignored，
// 不提交）。表名与列名尽量贴近线上 Drizzle 模型；settings 的 `values`
// 列因是 SQL 关键字，在库里叫 values_text，读写时映射回 `values`。

import { Database } from 'bun:sqlite'
import type {
  Asset,
  CharacterProfile,
  CharacterSettings,
  CustomField,
  StateDefinition,
} from '../../client/src/shared'

export const SETTINGS_FIELDS = [
  'characterName',
  'identity',
  'origin',
  'background',
  'worldSetting',
  'relationship',
  'personality',
  'temperament',
  'values',
  'strengths',
  'weaknesses',
  'emotionalTraits',
  'quirks',
  'speakingStyle',
  'tone',
  'vocabulary',
  'addressStyle',
  'responseStyle',
  'catchphrases',
  'forbiddenBehaviors',
  'appearance',
  'hair',
  'eyes',
  'outfit',
  'accessories',
  'bodyFeatures',
  'colorPalette',
  'visualStyle',
  'consistencyRules',
  'generationPrompt',
  'negativePrompt',
  'compositionPreferences',
  'imageConstraints',
] as const

export type SettingsField = (typeof SETTINGS_FIELDS)[number]

export const EMPTY_SETTINGS: Record<SettingsField, string> = {
  characterName: '',
  identity: '',
  origin: '',
  background: '',
  worldSetting: '',
  relationship: '',
  personality: '',
  temperament: '',
  values: '',
  strengths: '',
  weaknesses: '',
  emotionalTraits: '',
  quirks: '',
  speakingStyle: '',
  tone: '',
  vocabulary: '',
  addressStyle: '',
  responseStyle: '',
  catchphrases: '',
  forbiddenBehaviors: '',
  appearance: '',
  hair: '',
  eyes: '',
  outfit: '',
  accessories: '',
  bodyFeatures: '',
  colorPalette: '',
  visualStyle: '',
  consistencyRules: '',
  generationPrompt: '',
  negativePrompt: '',
  compositionPreferences: '',
  imageConstraints: '',
}

export interface DbProfileRow {
  id: string
  name: string
  subtitle: string
  description: string
  tags: string // JSON string[]
  favorite: number
  cover_asset_id: string | null
  settings_id: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface DbSettingsRow {
  id: string
  profile_id: string
  character_name: string
  identity: string
  origin: string
  background: string
  world_setting: string
  relationship: string
  personality: string
  temperament: string
  values_text: string
  strengths: string
  weaknesses: string
  emotional_traits: string
  quirks: string
  speaking_style: string
  tone: string
  vocabulary: string
  address_style: string
  response_style: string
  catchphrases: string
  forbidden_behaviors: string
  appearance: string
  hair: string
  eyes: string
  outfit: string
  accessories: string
  body_features: string
  color_palette: string
  visual_style: string
  consistency_rules: string
  generation_prompt: string
  negative_prompt: string
  composition_preferences: string
  image_constraints: string
  custom_fields: string // JSON CustomField[]
  updated_at: string
}

export interface DbStateDefRow {
  id: string
  state_key: string
  name: string
  description: string
  required: number
  configurable: number
  runtime_state_key: string | null
  sort_order: number
}

export interface DbAssetRow {
  id: string
  profile_id: string
  media_type: string
  format: string
  file_path: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  file_size: number | null
  sha256: string | null
  source: string
  prompt: string | null
  note: string | null
  status: string // 'asset' | 'candidate'
  state_key: string | null
  created_at: string
}

export interface DbLinkRow {
  id: string
  profile_id: string
  state_key: string
  asset_id: string
  is_selected: number
  created_at: string
}

export interface DbActivationRow {
  id: string
  profile_id: string
  activated_at: string
  provider_status: string
  snapshot_json: string
}

export interface DbJobRow {
  id: string
  profile_id: string
  state_key: string
  status: string
  error: string | null
  created_at: string
}

export interface DbReferenceRow {
  id: string
  profile_id: string
  asset_id: string
  kind: string
  created_at: string
}

export function uuidv7(): string {
  return Bun.randomUUIDv7()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function sha256Hex(bytes: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
}

export function openDb(dbPath: string): Database {
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}

export function initDb(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      favorite INTEGER NOT NULL DEFAULT 0,
      cover_asset_id TEXT,
      settings_id TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS character_settings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE,
      character_name TEXT NOT NULL DEFAULT '',
      identity TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT '',
      background TEXT NOT NULL DEFAULT '',
      world_setting TEXT NOT NULL DEFAULT '',
      relationship TEXT NOT NULL DEFAULT '',
      personality TEXT NOT NULL DEFAULT '',
      temperament TEXT NOT NULL DEFAULT '',
      values_text TEXT NOT NULL DEFAULT '',
      strengths TEXT NOT NULL DEFAULT '',
      weaknesses TEXT NOT NULL DEFAULT '',
      emotional_traits TEXT NOT NULL DEFAULT '',
      quirks TEXT NOT NULL DEFAULT '',
      speaking_style TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      vocabulary TEXT NOT NULL DEFAULT '',
      address_style TEXT NOT NULL DEFAULT '',
      response_style TEXT NOT NULL DEFAULT '',
      catchphrases TEXT NOT NULL DEFAULT '',
      forbidden_behaviors TEXT NOT NULL DEFAULT '',
      appearance TEXT NOT NULL DEFAULT '',
      hair TEXT NOT NULL DEFAULT '',
      eyes TEXT NOT NULL DEFAULT '',
      outfit TEXT NOT NULL DEFAULT '',
      accessories TEXT NOT NULL DEFAULT '',
      body_features TEXT NOT NULL DEFAULT '',
      color_palette TEXT NOT NULL DEFAULT '',
      visual_style TEXT NOT NULL DEFAULT '',
      consistency_rules TEXT NOT NULL DEFAULT '',
      generation_prompt TEXT NOT NULL DEFAULT '',
      negative_prompt TEXT NOT NULL DEFAULT '',
      composition_preferences TEXT NOT NULL DEFAULT '',
      image_constraints TEXT NOT NULL DEFAULT '',
      custom_fields TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state_definitions (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      required INTEGER NOT NULL DEFAULT 0,
      configurable INTEGER NOT NULL DEFAULT 0,
      runtime_state_key TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS state_links (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      state_key TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      is_selected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, state_key, asset_id)
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      format TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      sha256 TEXT,
      source TEXT NOT NULL DEFAULT 'upload',
      prompt TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'asset',
      state_key TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      state_key TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      provider_status TEXT NOT NULL DEFAULT 'local_record',
      snapshot_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS active_profile (
      scope TEXT PRIMARY KEY,
      profile_id TEXT
    );
    CREATE TABLE IF NOT EXISTS asset_references (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, asset_id, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_assets_profile ON assets(profile_id);
    CREATE INDEX IF NOT EXISTS idx_links_profile ON state_links(profile_id, state_key);
    CREATE INDEX IF NOT EXISTS idx_activations_profile ON activations(profile_id, activated_at);
  `)
}

// ---- 行记录 ↔ 前端领域类型的映射（字段名与线上返回一致） ----

const FIELD_TO_COLUMN: Record<SettingsField, keyof DbSettingsRow> = {
  characterName: 'character_name',
  identity: 'identity',
  origin: 'origin',
  background: 'background',
  worldSetting: 'world_setting',
  relationship: 'relationship',
  personality: 'personality',
  temperament: 'temperament',
  values: 'values_text',
  strengths: 'strengths',
  weaknesses: 'weaknesses',
  emotionalTraits: 'emotional_traits',
  quirks: 'quirks',
  speakingStyle: 'speaking_style',
  tone: 'tone',
  vocabulary: 'vocabulary',
  addressStyle: 'address_style',
  responseStyle: 'response_style',
  catchphrases: 'catchphrases',
  forbiddenBehaviors: 'forbidden_behaviors',
  appearance: 'appearance',
  hair: 'hair',
  eyes: 'eyes',
  outfit: 'outfit',
  accessories: 'accessories',
  bodyFeatures: 'body_features',
  colorPalette: 'color_palette',
  visualStyle: 'visual_style',
  consistencyRules: 'consistency_rules',
  generationPrompt: 'generation_prompt',
  negativePrompt: 'negative_prompt',
  compositionPreferences: 'composition_preferences',
  imageConstraints: 'image_constraints',
}

export function settingsRowToDomain(row: DbSettingsRow): CharacterSettings {
  const out: Record<string, unknown> = {
    id: row.id,
    profileId: row.profile_id,
    customFields: JSON.parse(row.custom_fields) as CustomField[],
  }
  for (const f of SETTINGS_FIELDS) out[f] = row[FIELD_TO_COLUMN[f]] as string
  return out as unknown as CharacterSettings
}

export function settingsDomainToColumns(s: Partial<Record<SettingsField, string>>): Partial<Record<keyof DbSettingsRow, string>> {
  const out: Partial<Record<keyof DbSettingsRow, string>> = {}
  for (const f of SETTINGS_FIELDS) {
    if (s[f] !== undefined) out[FIELD_TO_COLUMN[f]] = s[f] as string
  }
  return out
}

export function profileRowToDomain(row: DbProfileRow, extra: { assetCount: number; configuredStates: number; totalStates: number; isActive: boolean; coverUrl: string | null }): CharacterProfile {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle || null,
    description: row.description || null,
    coverAssetId: row.cover_asset_id,
    settingsId: row.settings_id,
    galleryId: null,
    tags: JSON.parse(row.tags) as string[],
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    coverUrl: extra.coverUrl,
    progress: { configured: extra.configuredStates, total: extra.totalStates },
  }
}

export function stateDefRowToDomain(row: DbStateDefRow): StateDefinition {
  return {
    id: row.id,
    stateKey: row.state_key,
    name: row.name,
    description: row.description,
    required: row.required === 1,
    configurable: row.configurable === 1,
    runtimeStateKey: row.runtime_state_key,
    sortOrder: row.sort_order,
  }
}

export function assetRowToDomain(row: DbAssetRow, baseUrl: string): Asset {
  return {
    id: row.id,
    profileId: row.profile_id,
    mediaType: row.media_type as Asset['mediaType'],
    format: row.format,
    filePath: row.file_path,
    thumbnailPath: row.thumbnail_path,
    width: row.width,
    height: row.height,
    fileSize: row.file_size,
    sha256: row.sha256,
    source: row.source as Asset['source'],
    prompt: row.prompt,
    createdAt: row.created_at,
    url: `${baseUrl}/assets/${row.profile_id}/${row.id}.${row.format}`,
    note: row.note,
  }
}

/** settingsText：按线上实测格式拼接，空字段不列出。种子数据下与线上逐字一致。 */
export function buildSettingsText(profile: { name: string; subtitle: string | null }, s: CharacterSettings): string {
  const lines: string[] = []
  const section = (title: string, body: string[]) => {
    if (body.length > 0) lines.push('', `## ${title}`, ...body)
  }
  lines.push(`# ${profile.name}${profile.subtitle ? ` · ${profile.subtitle}` : ''}`)
  section('基础身份', [
    ...withLines((p) => {
      p('名字', s.characterName)
      p('身份定位', s.identity)
      p('来源', s.origin)
      p('与用户的关系', s.relationship)
      // 线上种子里以下字段均为空，实测文本中未出现；为不丢失信息，
      // 非空时按同组补列（见 BACKEND.md 标注）。
      p('背景', s.background)
      p('世界观', s.worldSetting)
    }),
  ])
  section('人格设定', [
    ...withLines((p) => {
      p('核心性格', s.personality)
      p('情绪倾向', s.temperament)
      p('价值观', s.values)
      p('优点', s.strengths)
      p('缺点', s.weaknesses)
      p('情绪特征', s.emotionalTraits)
      p('小习惯', s.quirks)
    }),
  ])
  section('交流设定', [
    ...withLines((p) => {
      p('说话风格', s.speakingStyle)
      p('语气', s.tone)
      p('回答方式', s.responseStyle)
      p('禁止行为', s.forbiddenBehaviors)
      p('词汇习惯', s.vocabulary)
      p('称呼方式', s.addressStyle)
      p('口头禅', s.catchphrases)
    }),
  ])
  section('外观设定', [
    ...withLines((p) => {
      p('整体外观', s.appearance)
      p('发型发色', s.hair)
      p('眼睛', s.eyes)
      p('服装', s.outfit)
      p('主要配色', s.colorPalette)
      p('视觉风格', s.visualStyle)
      p('一致性规则', s.consistencyRules)
      p('配饰', s.accessories)
      p('体貌特征', s.bodyFeatures)
    }),
  ])
  // 图片生成设定：种子里四项均为空，线上文本未出现；非空时单列一组。
  section('图片生成设定', [
    ...withLines((p) => {
      p('生成提示词', s.generationPrompt)
      p('负面提示词', s.negativePrompt)
      p('构图偏好', s.compositionPreferences)
      p('图片约束', s.imageConstraints)
    }),
  ])
  if (s.customFields.length > 0) {
    section('自定义补充', s.customFields.map((f) => `- ${f.key}：${f.value}`))
  }
  return lines.join('\n')
}

function withLines(fn: (push: (label: string, value: string | undefined | null) => void) => void): string[] {
  const out: string[] = []
  fn((label, value) => {
    if (value && value.trim() !== '') out.push(`- ${label}：${value}`)
  })
  return out
}
