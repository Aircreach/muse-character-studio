import { useState } from 'react'
import type { GenerationCandidate } from '../shared'
import { useDraft } from '../hooks/useDraft'
import { Badge, Button, EmptyState } from './ui'

/**
 * Generation centre — candidates are kept separate from gallery assets.
 * A generated product is status=candidate until the user adopts it;
 * adopting never overwrites an existing asset. The brief/extra draft
 * survives tab switches via useDraft.
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
  onGenerate: (stateKey: string, stateBrief: string, extra: string) => void
  onAdopt: (candidateId: string, stateKey: string) => void
  onDiscard: (candidateId: string) => void
  generating: boolean
}) {
  const [stateKey, setStateKey] = useState(stateDefs[0]?.stateKey ?? 'base')
  const brief = useDraft('generate-brief', `${profileId}:${stateKey}`, { stateBrief: '', extra: '' })

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h3 className="font-display text-lg text-[var(--color-ink)]">生成新形象</h3>
        <p className="mt-0.5 text-[13px] text-[var(--color-ink-3)]">
          生成时会自动注入角色外观、人格、风格约束与目标状态要求；生成结果先进入候选区，确认后才加入画廊。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">目标状态</span>
            <select className="field-input" value={stateKey} onChange={(e) => setStateKey(e.target.value)}>
              {stateDefs.map((d) => (
                <option key={d.stateKey} value={d.stateKey}>
                  {d.name}（{d.stateKey}）
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block">
          <span className="field-label">状态描述（≤1000 字）</span>
          <textarea
            className="field-input min-h-[72px] resize-y"
            maxLength={1000}
            placeholder="例如：思考状态，视线略向下，表情冷静，手部呈思考姿态"
            value={brief.value.stateBrief}
            onChange={(e) => brief.setValue({ ...brief.value, stateBrief: e.target.value })}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">补充要求（≤1000 字）</span>
          <textarea
            className="field-input min-h-[72px] resize-y"
            maxLength={1000}
            placeholder="禁止更改发型、服装配色等"
            value={brief.value.extra}
            onChange={(e) => brief.setValue({ ...brief.value, extra: e.target.value })}
          />
        </label>
        <div className="mt-4">
          <Button
            variant="accent"
            disabled={generating}
            onClick={() => {
              onGenerate(stateKey, brief.value.stateBrief, brief.value.extra)
              brief.clear()
            }}
          >
            {generating ? '生成中…' : '开始生成'}
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display text-lg text-[var(--color-ink)]">生成候选</h3>
          <Badge tone="accent">与正式素材分离</Badge>
        </div>
        {candidates.length === 0 ? (
          <EmptyState title="暂无生成候选" body="生成的结果会先出现在这里，采纳后才进入状态画廊，旧素材不会被覆盖。" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <article key={c.id} className="card overflow-hidden">
                {c.url ? <img src={c.url} alt="生成候选" className="aspect-square w-full object-cover" /> : null}
                <div className="p-4">
                  <p className="text-sm font-medium text-[var(--color-ink)]">{c.stateKey}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-[var(--color-ink-3)]">{c.prompt}</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="primary" onClick={() => onAdopt(c.id, c.stateKey)}>
                      采纳进画廊
                    </Button>
                    <Button variant="ghost" onClick={() => onDiscard(c.id)}>
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
