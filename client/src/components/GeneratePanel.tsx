import { useState } from 'react'
import type { GenerationCandidate } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Icon } from './icons'
import { Badge, Button, EmptyState, Field, Panel, SelectInput, TextArea } from './ui'

/**
 * Generation centre — candidates stay separate from gallery assets
 * until the user adopts one. The brief draft survives tab switches,
 * and is cleared only after a generate request succeeds.
 */
export function GeneratePanel({
  profileId,
  stateDefs,
  candidates,
  onGenerate,
  onAdopt,
  onDiscard,
  generating,
}: {
  profileId: string
  stateDefs: Array<{ stateKey: string; name: string }>
  candidates: GenerationCandidate[]
  onGenerate: (stateKey: string, stateBrief: string, extra: string) => Promise<unknown>
  onAdopt: (candidateId: string, stateKey: string) => void
  onDiscard: (candidateId: string) => void
  generating: boolean
}) {
  const [stateKey, setStateKey] = useState(stateDefs[0]?.stateKey ?? 'base')
  const brief = useDraft('generate-brief', `${profileId}:${stateKey}`, { stateBrief: '', extra: '' })

  return (
    <div className="stack">
      <Panel
        title="生成新形象"
        note="生成时会自动注入角色外观、人格、风格约束与目标状态要求；生成结果先进入候选区，确认后才加入画廊。"
      >
        <div className="stack">
          <Field label="目标状态" className="field-narrow">
            <SelectInput value={stateKey} onChange={(e) => setStateKey(e.target.value)}>
              {stateDefs.map((d) => (
                <option key={d.stateKey} value={d.stateKey}>
                  {d.name}（{d.stateKey}）
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="状态描述（≤1000 字）">
            <TextArea
              maxLength={1000}
              placeholder="例如：思考状态，视线略向下，表情冷静，手部呈思考姿态"
              value={brief.value.stateBrief}
              onChange={(e) => brief.setValue({ ...brief.value, stateBrief: e.target.value })}
            />
          </Field>
          <Field label="补充要求（≤1000 字）">
            <TextArea
              maxLength={1000}
              placeholder="禁止更改发型、服装配色等"
              value={brief.value.extra}
              onChange={(e) => brief.setValue({ ...brief.value, extra: e.target.value })}
            />
          </Field>
          <div>
            <Button
              variant="primary"
              disabled={generating}
              onClick={() => {
                // 生成简述草稿只在生成成功发出后才清；失败时保留，改完可直接重试。
                void onGenerate(stateKey, brief.value.stateBrief, brief.value.extra)
                  .then(() => brief.clear())
                  .catch(() => undefined)
              }}
            >
              <Icon name="spark" />
              {generating ? '生成中…' : '开始生成'}
            </Button>
          </div>
        </div>
      </Panel>

      <section className="stack-sm">
        <div className="cluster">
          <h2 className="section-title">生成候选</h2>
          <Badge tone="accent">与正式素材分离</Badge>
        </div>
        {candidates.length === 0 ? (
          <EmptyState icon="spark" title="暂无生成候选" body="生成的结果会先出现在这里，采纳后才进入状态画廊，旧素材不会被覆盖。" />
        ) : (
          <div className="tile-grid">
            {candidates.map((c) => (
              <article key={c.id} className="panel gallery-card">
                {c.url ? (
                  <div className="media-11">
                    <img className="media-img" src={c.url} alt="生成候选" />
                  </div>
                ) : null}
                <div className="card-body">
                  <p className="card-title">{c.stateKey}</p>
                  <p className="meta clamp-2">{c.prompt}</p>
                  <div className="action-row">
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
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
