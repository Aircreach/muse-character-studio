import { useMemo, useState } from 'react'
import type { CharacterSettings, SettingsPatch } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Button, Modal } from './ui'

type Field = { key: keyof Omit<CharacterSettings, 'id' | 'profileId' | 'customFields'>; label: string; hint?: string; textarea?: boolean }

const GROUPS: Array<{ title: string; note: string; fields: Field[] }> = [
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
    note: '本轮新单列的分组：不希望出现的行为与行为边界。旧版 forbiddenBehaviors 保留在此组，不再混在交流风格里。',
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
 * Draft is persisted via useDraft (localStorage mirror) so switching
 * tabs never loses edits; it clears only after a successful save.
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
  onSave: (patch: SettingsPatch) => void
  saving: boolean
}) {
  const draft = useDraft<SettingsPatch>(`settings`, profileId, {})
  const [previewOpen, setPreviewOpen] = useState(false)
  const merged: CharacterSettings = useMemo(
    () => ({ ...initial, ...draft.value, customFields: draft.value.customFields ?? initial.customFields }),
    [initial, draft],
  )
  const setField = (key: Field['key'], value: string) => draft.setValue({ ...draft.value, [key]: value })

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[var(--color-ink-3)]">
        设定分 7 组编辑，改完点保存才会写入；切换页面不会丢草稿，保存成功后草稿自动清除。
      </p>
      {GROUPS.map((g) => (
        <section key={g.title} className="card p-5">
          <h3 className="font-display text-lg text-[var(--color-ink)]">{g.title}</h3>
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-3)]">{g.note}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <label key={f.key} className={f.textarea ? 'sm:col-span-2 block' : 'block'}>
                <span className="field-label">{f.label}</span>
                {f.textarea ? (
                  <textarea
                    className="field-input min-h-[72px] resize-y"
                    rows={3}
                    maxLength={4000}
                    value={(merged[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    className="field-input"
                    maxLength={4000}
                    value={(merged[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="card p-5">
        <h3 className="font-display text-lg text-[var(--color-ink)]">自定义补充</h3>
        <p className="mt-0.5 text-[13px] text-[var(--color-ink-3)]">战斗状态、日常生活、情绪表达规则等，最多 40 项，不会因为没有对应 UI 而丢失。</p>
        <div className="mt-4 space-y-3">
          {merged.customFields.map((cf, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <input
                className="field-input"
                placeholder="字段名"
                value={cf.key}
                onChange={(e) => {
                  const next = [...merged.customFields]
                  next[i] = { ...next[i], key: e.target.value }
                  draft.setValue({ ...draft.value, customFields: next })
                }}
              />
              <input
                className="field-input"
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
                onClick={() => {
                  const next = merged.customFields.filter((_, j) => j !== i)
                  draft.setValue({ ...draft.value, customFields: next })
                }}
              >
                删除
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={merged.customFields.length >= 40}
            onClick={() =>
              draft.setValue({ ...draft.value, customFields: [...merged.customFields, { key: '', value: '' }] })
            }
          >
            + 增加自定义字段
          </Button>
        </div>
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-3 shadow-[var(--shadow-md)] backdrop-blur">
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => {
            onSave(draft.value)
            draft.clear()
          }}
        >
          {saving ? '保存中…' : '保存设定'}
        </Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          查看整合预览
        </Button>
        <span className="text-xs text-[var(--color-ink-3)]">草稿已自动保存到本地，切换页面不会丢失。</span>
      </div>

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title="整合设定预览" wide>
        <p className="text-xs text-[var(--color-ink-3)]">以下为最终传递给 Muse 的整合文本（只读）。</p>
        <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-4 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
          {settingsText || '（暂无整合文本，先保存一次设定。）'}
        </pre>
      </Modal>
    </div>
  )
}
