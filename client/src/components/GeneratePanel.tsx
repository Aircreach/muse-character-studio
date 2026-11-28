import { useState } from 'react'
import type { GenerationCandidate } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Icon } from './icons'
import { Badge, Button, EmptyState, Field, Panel, TextArea } from './ui'
import { RuntimeMedia, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * Generation Atelier — Candidates remain strictly separated from formal gallery assets
 * until explicitly adopted. Draft briefs persist per (profileId, stateKey).
 */
export function GeneratePanel({
  profileId,
  stateDefs,
  candidates,
  onGenerate,
  onAdopt,
  onDiscard,
  onPreview,
  generating,
}: {
  profileId: string
  stateDefs: Array<{ stateKey: string; name: string }>
  candidates: GenerationCandidate[]
  onGenerate: (stateKey: string, stateBrief: string, extra: string) => Promise<unknown>
  onAdopt: (candidateId: string, stateKey: string) => void
  onDiscard: (candidateId: string) => void
  onPreview: (source: RuntimeMediaSource, label: string) => void
  generating: boolean
}) {
  const [stateKey, setStateKey] = useState(stateDefs[0]?.stateKey ?? 'base')
  const brief = useDraft('generate-brief', `${profileId}:${stateKey}`, { stateBrief: '', extra: '' })

  return (
    <div className="stack">
      <Panel
        title="构思与生成新形象"
        note="生成时自动注入当前角色的外观、人格、风格约束与所选状态要求；产物先进入候选区，采纳后才进入画廊。"
      >
        <div className="stack">
          <div className="stack-sm">
            <span className="field-label">目标状态</span>
            <div className="state-selector-grid" role="group" aria-label="选择目标状态">
              {stateDefs.map((d) => (
                <button
                  key={d.stateKey}
                  type="button"
                  className="state-select-pill"
                  aria-pressed={stateKey === d.stateKey}
                  onClick={() => setStateKey(d.stateKey)}
                >
                  <span>{d.name}</span>
                  <span className="state-select-key">{d.stateKey}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="状态画面描述" counter={`${brief.value.stateBrief.length} / 1000`}>
            <TextArea
              maxLength={1000}
              rows={3}
              placeholder="例如：思考状态，视线略向下，表情冷静克制，手部呈轻托下颌姿态"
              value={brief.value.stateBrief}
              onChange={(e) => brief.setValue({ ...brief.value, stateBrief: e.target.value })}
            />
          </Field>

          <Field label="补充约束与禁忌" counter={`${brief.value.extra.length} / 1000`}>
            <TextArea
              maxLength={1000}
              rows={2}
              placeholder="例如：保持纯白柔光背景，禁止更改黑色长发与右眼蓝焰"
              value={brief.value.extra}
              onChange={(e) => brief.setValue({ ...brief.value, extra: e.target.value })}
            />
          </Field>

          <div className="split">
            <Button
              variant="accent"
              disabled={generating}
              onClick={() => {
                void onGenerate(stateKey, brief.value.stateBrief, brief.value.extra)
                  .then(() => brief.clear())
                  .catch(() => undefined)
              }}
            >
              <Icon name="spark" size={15} />
              {generating ? '生成中…' : '开始生成候选'}
            </Button>
            <span className="meta">草稿按状态独立保存，失败时自动保留以便调整重试。</span>
          </div>
        </div>
      </Panel>

      <section className="sheet-group">
        <div className="sheet-group-head">
          <div className="cluster">
            <h2 className="sheet-heading">生成候选区</h2>
            <Badge tone="accent">与正式素材分离</Badge>
          </div>
          <span className="mono">{candidates.length} 个候选</span>
        </div>

        {candidates.length === 0 ? (
          <EmptyState
            icon="spark"
            title="暂无待审核候选"
            body="生成的新形象会先停留在这里。点击「采纳进画廊」后才会写入正式槽位，既有素材不会被覆盖。"
          />
        ) : (
          <div className="gallery-grid">
            {candidates.map((c) => {
              const candidateSource: RuntimeMediaSource | null = c.url
                ? { kind: 'image', url: c.url, label: '生成候选 · 待审核', alt: `生成候选 ${c.stateKey}` }
                : null
              return (
                <article key={c.id} className="gallery-card">
                  <div className="media-43">
                    <RuntimeMedia
                      source={candidateSource}
                      emptyTitle="候选无预览"
                      emptyNote="该候选记录没有可预览的图片。"
                      onActivate={(s) => onPreview(s, `生成候选 · ${c.stateKey}`)}
                    />
                  </div>
                  <div className="card-body">
                    <div className="split">
                      <h3 className="card-title">{c.stateKey}</h3>
                      <Badge tone="warn">候选</Badge>
                    </div>
                    <p className="meta clamp-2">{c.prompt || '（无提示词记录）'}</p>
                    <div className="action-row" style={{ marginTop: 'auto' }}>
                      <Button variant="primary" size="sm" onClick={() => onAdopt(c.id, c.stateKey)}>
                        <Icon name="check" size={14} />
                        采纳进画廊
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDiscard(c.id)}>
                        <Icon name="trash" size={14} />
                        丢弃
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
