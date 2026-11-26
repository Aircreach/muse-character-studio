// server/src/seed.ts — 精确还原线上 seedStudio 的种子数据。
//
// 来源：线上 getStudio / getProfileDetail 实测（2026-11-26）。
// 两张卡的 profile id、settings id、state_definitions 的 id、全部文案
// 都按实测原样写死；createdAt 也按线上值写死，
// 这样本地首次启动后的数据与线上首开数据逐项一致。

import type { Database } from 'bun:sqlite'
import { EMPTY_SETTINGS, type SettingsField } from './schema'

export const SEED_CREATED_AT = '2026-11-26T09:55:34.819Z'

export interface SeedStateDef {
  id: string
  stateKey: string
  name: string
  description: string
  required: boolean
  configurable: boolean
  runtimeStateKey: string | null
  sortOrder: number
}

export const SEED_STATE_DEFS: SeedStateDef[] = [
  {
    id: '01a21748-28df-7000-848c-34573b07eaf2',
    stateKey: 'base',
    name: '基础形象',
    description: 'Muse 的单一基础形象，全部动画状态由它派生。这是 shared_base 模式下唯一可同步到 Muse 的槽位。',
    required: true,
    configurable: true,
    runtimeStateKey: null,
    sortOrder: 0,
  },
  {
    id: '01a21748-28e1-7000-9c99-88ed5de3b038',
    stateKey: 'idle',
    name: '待机',
    description: '无交互时的静止状态。Muse 运行时由基础形象自动生成，工作室可另存素材备用。',
    required: false,
    configurable: false,
    runtimeStateKey: 'idle',
    sortOrder: 1,
  },
  {
    id: '01a21748-28e2-7000-bea0-bf7a23b22838',
    stateKey: 'waking',
    name: '唤醒',
    description: 'Muse 被唤醒时的过渡状态，运行时自动生成。',
    required: false,
    configurable: false,
    runtimeStateKey: 'waking',
    sortOrder: 2,
  },
  {
    id: '01a21748-28e3-7000-91f2-4635d66a1249',
    stateKey: 'listening',
    name: '聆听',
    description: '聆听用户说话的状态（工作室状态，Muse 当前无独立运行时槽位）。',
    required: false,
    configurable: false,
    runtimeStateKey: null,
    sortOrder: 3,
  },
  {
    id: '01a21748-28e3-7001-b9a4-259ee4be2688',
    stateKey: 'thinking',
    name: '思考',
    description: '思考与推理中的状态（工作室状态，Muse 当前无独立运行时槽位）。',
    required: false,
    configurable: false,
    runtimeStateKey: null,
    sortOrder: 4,
  },
  {
    id: '01a21748-28e3-7002-adb6-99aaca0b6167',
    stateKey: 'speaking',
    name: '说话',
    description: '回复用户时的状态（工作室状态，Muse 当前无独立运行时槽位）。',
    required: false,
    configurable: false,
    runtimeStateKey: null,
    sortOrder: 5,
  },
  {
    id: '01a21748-28e3-7003-8b1d-03df0fc93942',
    stateKey: 'working',
    name: '工作',
    description: '执行任务时的状态。Muse 运行时由基础形象自动生成。',
    required: false,
    configurable: false,
    runtimeStateKey: 'working',
    sortOrder: 6,
  },
  {
    id: '01a21748-28e3-7004-ada5-4a4177fcfedc',
    stateKey: 'generating',
    name: '生成',
    description: '生成内容时的状态，对应运行时的“制作中”动画。',
    required: false,
    configurable: false,
    runtimeStateKey: 'making_something',
    sortOrder: 7,
  },
  {
    id: '01a21748-28e3-7005-b36b-2b2dd9d683e0',
    stateKey: 'happy',
    name: '愉悦',
    description: '完成里程碑时的愉悦状态，对应运行时的“里程碑”动画。',
    required: false,
    configurable: false,
    runtimeStateKey: 'milestone_level_up',
    sortOrder: 8,
  },
  {
    id: '01a21748-28e3-7006-bb59-589c2064f34f',
    stateKey: 'error',
    name: '错误',
    description: '出错时的状态（工作室状态，Muse 当前无独立运行时槽位）。',
    required: false,
    configurable: false,
    runtimeStateKey: null,
    sortOrder: 9,
  },
]

export interface SeedProfile {
  id: string
  settingsId: string
  name: string
  subtitle: string
  description: string
  tags: string[]
  favorite: boolean
  settings: Partial<Record<SettingsField, string>> & { customFields: Array<{ key: string; value: string }> }
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    id: '01a21748-2923-7000-b4c7-8fae8e6bc980',
    settingsId: '01a21748-2923-7002-a171-16f93b2ebecd',
    name: '黑岩射手',
    subtitle: '原作人格',
    description: '原作人格：冷淡、寡言、战斗风格。',
    tags: ['原作', '战斗'],
    favorite: true,
    settings: {
      ...EMPTY_SETTINGS,
      characterName: '黑岩射手',
      identity: '原作角色 · 战斗形态',
      origin: '原作角色',
      relationship: '亲密伙伴',
      personality: '冷淡、寡言、外冷内热',
      temperament: '平静、克制',
      speakingStyle: '简短直接，情绪表达克制',
      tone: '平静',
      responseStyle: '简短，不主动夸张表达情绪，偶尔表现出细微的关心',
      forbiddenBehaviors: '不刻意卖萌；不夸张表达情绪',
      appearance: '原作外观',
      hair: '黑色长发',
      eyes: '眼中燃着蓝色火焰',
      outfit: '原作战斗服装',
      colorPalette: '黑、白、蓝',
      visualStyle: '战斗风格',
      consistencyRules: '保持黑色长发与蓝色火焰眼；不更改角色年龄感',
      customFields: [{ key: '标志特征', value: '蓝色火焰' }],
    },
  },
  {
    id: '01a21748-2923-7001-8d21-3bc699c4c9f9',
    settingsId: '01a21748-2923-7003-a5eb-3cbceffa7fa7',
    name: '黑岩射手',
    subtitle: '日常人格',
    description: '日常人格：温柔、安静、更亲近。',
    tags: ['日常', '柔和'],
    favorite: false,
    settings: {
      ...EMPTY_SETTINGS,
      characterName: '黑岩射手',
      identity: '日常人格',
      origin: '原作角色',
      relationship: '更亲近的伙伴',
      personality: '温柔、安静',
      temperament: '柔和、平和',
      speakingStyle: '轻声、简短而温和',
      tone: '温柔',
      responseStyle: '安静亲近，不过分热闹',
      appearance: '日常形象',
      hair: '黑色长发',
      eyes: '柔和的蓝色眼睛',
      outfit: '日常服装',
      colorPalette: '柔和色调',
      visualStyle: '柔和画风',
      consistencyRules: '保持角色辨识度与黑色长发',
      customFields: [],
    },
  },
]

const SETTINGS_COLUMNS: Array<[SettingsField, string]> = [
  ['characterName', 'character_name'],
  ['identity', 'identity'],
  ['origin', 'origin'],
  ['background', 'background'],
  ['worldSetting', 'world_setting'],
  ['relationship', 'relationship'],
  ['personality', 'personality'],
  ['temperament', 'temperament'],
  ['values', 'values_text'],
  ['strengths', 'strengths'],
  ['weaknesses', 'weaknesses'],
  ['emotionalTraits', 'emotional_traits'],
  ['quirks', 'quirks'],
  ['speakingStyle', 'speaking_style'],
  ['tone', 'tone'],
  ['vocabulary', 'vocabulary'],
  ['addressStyle', 'address_style'],
  ['responseStyle', 'response_style'],
  ['catchphrases', 'catchphrases'],
  ['forbiddenBehaviors', 'forbidden_behaviors'],
  ['appearance', 'appearance'],
  ['hair', 'hair'],
  ['eyes', 'eyes'],
  ['outfit', 'outfit'],
  ['accessories', 'accessories'],
  ['bodyFeatures', 'body_features'],
  ['colorPalette', 'color_palette'],
  ['visualStyle', 'visual_style'],
  ['consistencyRules', 'consistency_rules'],
  ['generationPrompt', 'generation_prompt'],
  ['negativePrompt', 'negative_prompt'],
  ['compositionPreferences', 'composition_preferences'],
  ['imageConstraints', 'image_constraints'],
]

/** 写入种子：10 条状态定义 + A/B 两张卡。调用方保证幂等（已存在则跳过）。 */
export function insertSeedData(db: Database): void {
  const insertDef = db.prepare(
    'INSERT OR IGNORE INTO state_definitions (id, state_key, name, description, required, configurable, runtime_state_key, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  for (const d of SEED_STATE_DEFS) {
    insertDef.run(d.id, d.stateKey, d.name, d.description, d.required ? 1 : 0, d.configurable ? 1 : 0, d.runtimeStateKey, d.sortOrder)
  }

  const insertProfile = db.prepare(
    'INSERT OR IGNORE INTO character_profiles (id, name, subtitle, description, tags, favorite, cover_asset_id, settings_id, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)',
  )
  const settingsCols = SETTINGS_COLUMNS.map(([, c]) => c).join(', ')
  const placeholders = SETTINGS_COLUMNS.map(() => '?').join(', ')
  const insertSettings = db.prepare(
    `INSERT OR IGNORE INTO character_settings (id, profile_id, ${settingsCols}, custom_fields, updated_at) VALUES (?, ?, ${placeholders}, ?, ?)`,
  )
  for (const p of SEED_PROFILES) {
    insertProfile.run(p.id, p.name, p.subtitle, p.description, JSON.stringify(p.tags), p.favorite ? 1 : 0, p.settingsId, SEED_CREATED_AT, SEED_CREATED_AT)
    const values = SETTINGS_COLUMNS.map(([f]) => p.settings[f] ?? '')
    insertSettings.run(p.settingsId, p.id, ...values, JSON.stringify(p.settings.customFields ?? []), SEED_CREATED_AT)
  }
}
