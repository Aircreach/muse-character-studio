import { useMemo, useState } from 'react'
import type { CharacterSettings, SettingsPatch } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Button, Field, Modal, Panel, TextArea, TextInput } from './ui'

type FieldDef = { key: keyof Omit<CharacterSettings, 'id' | 'profileId' | 'customFields'>; label: string; hint?: string; textarea?: boolean }

const GROUPS: Array<{ title: string; note: string; fields: FieldDef[] }> = [
  {
    title: '基础身份',
    note: '角色在设定中的名字、定位与世界观。',
    fields: [
      { key: 'characterName', label: '角色名' },
      { key: 'identity', label: '身份定位', textarea: true },
      { key: 'origin', label: '来源（原作 / 原创）' },
      { key: 'background', label: '背景故事', textarea: true },
      { key: 'worldSetting', label: '所属世界观', textarea: true },
      { key: 'relationship', label: '与用户的关系' },
    ],
  },
  {
    title: '人格性格',
    note: '核心性格、情绪倾向与优缺点。',
    fields: [
      { key: 'personality', label: '核心性格', textarea: true },
      { key: 'temperament', label: '情绪倾向' },
      { key: 'values', label: '价值观', textarea: true },
      { key: 'strengths', label: '性格特点', textarea: true },
      { key: 'weaknesses', label: '性格弱点', textarea: true },
      { key: 'emotionalTraits', label: '情绪表现', textarea: true },
      { key: 'quirks', label: '特殊习惯', textarea: true },
    ],
  },
  {
    title: '交流风格',
    note: '说话方式、语气与称呼。',
    fields: [
      { key: 'speakingStyle', label: '说话风格', textarea: true },
      { key: 'tone', label: '语气' },
      { key: 'vocabulary', label: '用词习惯', textarea: true },
      { key: 'addressStyle', label: '称呼用户的方式' },
      { key: 'responseStyle', label: '回答方式', textarea: true },
      { key: 'catchphrases', label: '常用表达', textarea: true },
    ],
  },
  {
    title: '外观设定',
    note: '整体外观与必须保持的一致性特征。',
    fields: [
      { key: 'appearance', label: '整体外观', textarea: true },
      { key: 'hair', label: '发型、发色' },
      { key: 'eyes', label: '眼睛' },
      { key: 'outfit', label: '服装', textarea: true },
      { key: 'accessories', label: '配饰' },
      { key: 'bodyFeatures', label: '身体特征', textarea: true },
      { key: 'colorPalette', label: '主要配色' },
      { key: 'visualStyle', label: '视觉风格' },
      { key: 'consistencyRules', label: '必须保持的外观特征', textarea: true },
    ],
  },
  {
    title: '行为规则',
    note: '不希望出现的行为与边界，和交流风格分开保存。',
    fields: [{ key: 'forbiddenBehaviors', label: '不希望出现的行为', textarea: true }],
  },
  {
    title: '图片生成设定',
    note: '生成提示词与约束；编辑设定不自动触发生成。',
    fields: [
      { key: 'generationPrompt', label: '基础生成提示词', textarea: true },
      { key: 'negativePrompt', label: '禁止出现的内容', textarea: true },
      { key: 'compositionPreferences', label: '构图偏好', textarea: true },
      { key: 'imageConstraints', label: '图片约束', textarea: true },
    ],
  },
]

/**
 * Structured settings editor — never a single big textbox.
 * Draft is persisted via useDraft so switching tabs never loses edits.
 * The draft is cleared only after a successful save (onSave resolves);
 * if saving fails the draft is kept so nothing has to be retyped.
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
  const draft = useDraft<SettingsPatch>(`settings`, profileId, {})
  const [previewOpen, setPreviewOpen] = useState(false)
  const merged: CharacterSettings = useMemo(
    () => ({ ...initial, ...draft.value, customFields: draft.value.customFields ?? initial.customFields }),
    [initial, draft],
  )
  const setField = (key: FieldDef['key'], value: string) => draft.setValue({ ...draft.value, [key]: value })

  return (
    <div className="stack">
      <p className="meta">设定分 7 组编辑，改完点保存才会写入；切换页面不会丢草稿，保存成功后草稿自动清除。</p>
      {GROUPS.map((g) => (
        <Panel key={g.title} title={g.title} note={g.note}>
          <div className="form-grid">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} wide={f.textarea}>
                {f.textarea ? (
                  <TextArea
                    rows={3}
                    maxLength={4000}
                    value={(merged[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                ) : (
                  <TextInput
                    maxLength={4000}
                    value={(merged[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </Panel>
      ))}

      <Panel title="自定义补充" note="战斗状态、日常生活、情绪表达规则等，最多 40 项，不会因为没有对应 UI 而丢失。">
        <div className="stack">
          {merged.customFields.map((cf, i) => (
            <div key={i} className="custom-row">
              <TextInput
                placeholder="字段名"
                value={cf.key}
                onChange={(e) => {
                  const next = [...merged.customFields]
                  next[i] = { ...next[i], key: e.target.value }
                  draft.setValue({ ...draft.value, customFields: next })
                }}
              />
              <TextInput
                placeholder="内容"
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
                onClick={() => {
                  const next = merged.customFields.filter((_, j) => j !== i)
                  draft.setValue({ ...draft.value, customFields: next })
                }}
              >
                删除
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={merged.customFields.length >= 40}
              onClick={() =>
                draft.setValue({ ...draft.value, customFields: [...merged.customFields, { key: '', value: '' }] })
              }
            >
              + 增加自定义字段
            </Button>
          </div>
        </div>
      </Panel>

      <div className="save-bar">
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => {
            void onSave(draft.value)
              .then(() => draft.clear())
              .catch(() => undefined)
          }}
        >
          {saving ? '保存中…' : '保存设定'}
        </Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          查看整合预览
        </Button>
        <span className="meta">草稿已自动保存到本地，切换页面不会丢失。</span>
      </div>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title="整合设定预览" wide>
        <p className="meta">以下为最终传递给 Muse 的整合文本（只读）。</p>
        <pre className="pre-block">{settingsText || '（暂无整合文本，先保存一次设定。）'}</pre>
      </Modal>
    </div>
  )
}
