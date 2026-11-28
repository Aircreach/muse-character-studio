import { useMemo, useState } from 'react'
import type { CharacterSettings, SettingsPatch } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Icon } from './icons'
import { Badge, Button, Field, Modal, TextArea, TextInput } from './ui'

type FieldDef = {
  key: keyof Omit<CharacterSettings, 'id' | 'profileId' | 'customFields'>
  label: string
  textarea?: boolean
}

const GROUPS: Array<{ id: string; num: string; title: string; note: string; fields: FieldDef[] }> = [
  {
    id: 'group-identity',
    num: '01',
    title: '基础身份',
    note: '角色在设定中的名字、定位、世界观与关系。',
    fields: [
      { key: 'characterName', label: '角色名' },
      { key: 'origin', label: '来源（原作 / 原创）' },
      { key: 'relationship', label: '与用户的关系' },
      { key: 'identity', label: '身份定位', textarea: true },
      { key: 'background', label: '背景故事', textarea: true },
      { key: 'worldSetting', label: '所属世界观', textarea: true },
    ],
  },
  {
    id: 'group-personality',
    num: '02',
    title: '人格性格',
    note: '核心性格、情绪基调、价值观与独特习惯。',
    fields: [
      { key: 'temperament', label: '情绪倾向' },
      { key: 'personality', label: '核心性格', textarea: true },
      { key: 'values', label: '价值观', textarea: true },
      { key: 'strengths', label: '性格特点', textarea: true },
      { key: 'weaknesses', label: '性格弱点', textarea: true },
      { key: 'emotionalTraits', label: '情绪表现', textarea: true },
      { key: 'quirks', label: '特殊习惯', textarea: true },
    ],
  },
  {
    id: 'group-voice',
    num: '03',
    title: '交流风格',
    note: '语言节奏、语气温度与称呼习惯。',
    fields: [
      { key: 'tone', label: '语气' },
      { key: 'addressStyle', label: '称呼用户的方式' },
      { key: 'speakingStyle', label: '说话风格', textarea: true },
      { key: 'vocabulary', label: '用词习惯', textarea: true },
      { key: 'responseStyle', label: '回答方式', textarea: true },
      { key: 'catchphrases', label: '常用表达', textarea: true },
    ],
  },
  {
    id: 'group-appearance',
    num: '04',
    title: '外观设定',
    note: '视觉辨识要素与必须严格保持的一致性规则。',
    fields: [
      { key: 'hair', label: '发型、发色' },
      { key: 'eyes', label: '眼睛' },
      { key: 'colorPalette', label: '主要配色' },
      { key: 'visualStyle', label: '视觉风格' },
      { key: 'accessories', label: '配饰' },
      { key: 'appearance', label: '整体外观', textarea: true },
      { key: 'outfit', label: '服装', textarea: true },
      { key: 'bodyFeatures', label: '身体特征', textarea: true },
      { key: 'consistencyRules', label: '必须保持的外观特征', textarea: true },
    ],
  },
  {
    id: 'group-rules',
    num: '05',
    title: '行为规则',
    note: '明确禁止的行为与性格边界，与交流风格独立保存。',
    fields: [{ key: 'forbiddenBehaviors', label: '不希望出现的行为', textarea: true }],
  },
  {
    id: 'group-generation',
    num: '06',
    title: '图片生成设定',
    note: '基础提示词、负向约束与构图偏好；保存设定不会自动触发生成。',
    fields: [
      { key: 'generationPrompt', label: '基础生成提示词', textarea: true },
      { key: 'negativePrompt', label: '禁止出现的内容', textarea: true },
      { key: 'compositionPreferences', label: '构图偏好', textarea: true },
      { key: 'imageConstraints', label: '图片约束', textarea: true },
    ],
  },
]

/**
 * Unboxed Editorial Manuscript Dossier.
 * Renders cleanly inside the 2/3 monograph canvas with top chapter jump strip,
 * hairline-ruled sections, persistent local draft (`useDraft`), and compiled snapshot preview.
 */
export function SettingsForm({
  profileId,
  initial,
  settingsText,
  onSave,
  saving,
}: {
  profileId: string
  initial: CharacterSettings
  settingsText: string
  onSave: (patch: SettingsPatch) => Promise<unknown>
  saving: boolean
}) {
  const draft = useDraft<SettingsPatch>('settings', profileId, {})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const merged: CharacterSettings = useMemo(
    () => ({ ...initial, ...draft.value, customFields: draft.value.customFields ?? initial.customFields }),
    [initial, draft.value],
  )

  const hasDraft = Object.keys(draft.value).length > 0
  const setField = (key: FieldDef['key'], value: string) => draft.setValue({ ...draft.value, [key]: value })

  const copySettingsText = async () => {
    if (!settingsText) return
    try {
      await navigator.clipboard.writeText(settingsText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="manuscript-wrap">
      <nav className="chapter-strip" aria-label="手稿章节快速跳转">
        {GROUPS.map((g) => {
          const filled = g.fields.filter((f) => String(merged[f.key] ?? '').trim().length > 0).length
          return (
            <a key={g.id} href={`#${g.id}`} className="chapter-pill">
              <span className="num">{g.num}</span>
              <span>{g.title}</span>
              <span className="num">
                {filled}/{g.fields.length}
              </span>
            </a>
          )
        })}
        <a href="#group-custom" className="chapter-pill">
          <span className="num">07</span>
          <span>自定义补充</span>
          <span className="num">{merged.customFields.length}</span>
        </a>
      </nav>

      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="manuscript-section">
          <div>
            <span className="mono">CHAPTER {g.num}</span>
            <h2 className="panel-title" style={{ marginTop: 4 }}>
              {g.title}
            </h2>
            <p className="panel-note">{g.note}</p>
          </div>
          <div className="form-grid">
            {g.fields.map((f) => {
              const val = (merged[f.key] as string) ?? ''
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  wide={f.textarea}
                  counter={val.length > 0 ? `${val.length} / 4000` : undefined}
                >
                  {f.textarea ? (
                    <TextArea
                      rows={3}
                      maxLength={4000}
                      value={val}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : (
                    <TextInput maxLength={4000} value={val} onChange={(e) => setField(f.key, e.target.value)} />
                  )}
                </Field>
              )
            })}
          </div>
        </section>
      ))}

      <section id="group-custom" className="manuscript-section">
        <div className="split">
          <div>
            <span className="mono">CHAPTER 07</span>
            <h2 className="panel-title" style={{ marginTop: 4 }}>
              自定义补充
            </h2>
            <p className="panel-note">战斗状态、日常细节、情绪触发规则等扩展设定，最多 40 项。</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={merged.customFields.length >= 40}
            onClick={() =>
              draft.setValue({ ...draft.value, customFields: [...merged.customFields, { key: '', value: '' }] })
            }
          >
            <Icon name="plus" size={14} />
            新增字段
          </Button>
        </div>
        <div className="stack-sm">
          {merged.customFields.length === 0 ? (
            <p className="meta">暂无自定义字段。点击右侧「新增字段」可补充任意结构化设定。</p>
          ) : (
            merged.customFields.map((cf, i) => (
              <div key={i} className="custom-row">
                <TextInput
                  placeholder="字段名"
                  maxLength={60}
                  value={cf.key}
                  onChange={(e) => {
                    const next = [...merged.customFields]
                    next[i] = { ...next[i], key: e.target.value }
                    draft.setValue({ ...draft.value, customFields: next })
                  }}
                />
                <TextInput
                  placeholder="设定内容"
                  maxLength={4000}
                  value={cf.value}
                  onChange={(e) => {
                    const next = [...merged.customFields]
                    next[i] = { ...next[i], value: e.target.value }
                    draft.setValue({ ...draft.value, customFields: next })
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="删除此字段"
                  onClick={() => {
                    const next = merged.customFields.filter((_, j) => j !== i)
                    draft.setValue({ ...draft.value, customFields: next })
                  }}
                >
                  <Icon name="trash" size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="save-bar">
        <div className="save-bar-left">
          <Button
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={() => {
              void onSave(draft.value)
                .then(() => draft.clear())
                .catch(() => undefined)
            }}
          >
            <Icon name="check" size={14} />
            {saving ? '保存中…' : '保存设定'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            整合预览
          </Button>
        </div>
        <div className="save-bar-right">
          {hasDraft ? (
            <Badge tone="warn">本地草稿待保存</Badge>
          ) : (
            <span className="meta">切换页面自动保留草稿</span>
          )}
        </div>
      </div>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title="整合设定预览" wide>
        <div className="split">
          <p className="meta">以下为上次保存后由服务端生成的整合文本（只读快照，不写入 Muse 长期记忆）。</p>
          {settingsText ? (
            <Button variant="outline" size="sm" onClick={copySettingsText}>
              <Icon name={copied ? 'check' : 'copy'} size={14} />
              {copied ? '已复制' : '复制文本'}
            </Button>
          ) : null}
        </div>
        <pre className="pre-block">{settingsText || '（暂无整合文本，请先保存一次设定。）'}</pre>
      </Modal>
    </div>
  )
}
