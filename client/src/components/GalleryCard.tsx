import { useState } from 'react'
import type { StateDefinition, StateSlot } from '../shared'
import { Icon } from './icons'
import { Badge, Button, StatusMark } from './ui'
import { RuntimeMedia, sourceFromAsset, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * GalleryCard — Tailored exhibition card for each state slot:
 * 1. `base` renders as a featured 2-column anchor stage (the only configurable slot in shared_base).
 * 2. Runtime-driven states (idle/waking/working/generating/happy) render as 4:3 live media plates.
 * 3. Studio-only concept states (listening/thinking/speaking/error) render as compact, honest architectural cards.
 */
export function GalleryCard({
  def,
  slot,
  runtimeMedia,
  onPreview,
  onSelectAsset,
  onUpload,
  onGenerate,
  onReplace,
}: {
  def: StateDefinition
  slot: StateSlot | undefined
  runtimeMedia?: RuntimeMediaSource | null
  onPreview: (source: RuntimeMediaSource, label: string) => void
  onSelectAsset: (assetId: string) => void
  onUpload: () => void
  onGenerate: () => void
  onReplace: () => void
}) {
  const [compare, setCompare] = useState(false)
  const selected = slot?.assets.find((a) => a.isSelected) ?? slot?.assets[0]
  const isBase = def.stateKey === 'base'
  const isConceptOnly = !isBase && !def.runtimeStateKey

  const source: RuntimeMediaSource | null = isBase
    ? selected
      ? sourceFromAsset(selected)
      : null
    : (runtimeMedia ?? null)

  const empty = isBase
    ? { title: '尚未配置基础形象', note: '上传图片或视频，或在生成中心采纳候选后显示。', icon: 'image' as const }
    : def.runtimeStateKey
      ? {
          title: '暂无运行时画面',
          note: '将真实帧或视频放入 server/data/runtime-media/ 后自动展示。',
          icon: 'film' as const,
        }
      : {
          title: '非独立运行时槽位',
          note: '由 Muse 内部状态派生，无独立静态/视频文件。',
          icon: 'layers' as const,
        }

  /* 1. Featured Base Anchor Stage */
  if (isBase) {
    return (
      <article className="base-anchor-card">
        <div className="base-anchor-media">
          <RuntimeMedia
            source={source}
            badge={false}
            emptyTitle={empty.title}
            emptyNote={empty.note}
            emptyIcon={empty.icon}
            onActivate={(s) => onPreview(s, `${def.name} · ${s.label}`)}
          />
        </div>

        <div className="base-anchor-body">
          <div className="stack-sm">
            <div className="cluster">
              <Badge tone="accent">可配置 · 核心锚点</Badge>
              {def.required ? <Badge tone="neutral">必需</Badge> : null}
            </div>
            <div className="split">
              <h3 className="panel-title">{def.name}</h3>
              <span className="mono">{def.stateKey}</span>
            </div>
            <p className="prose">{def.description}</p>
            <StatusMark
              tone={selected ? 'good' : 'warn'}
              label={selected ? `已选定基础素材 · 共 ${slot?.assets.length ?? 0} 张候选` : '尚未选定素材（激活角色前需先配置）'}
            />
          </div>

          {slot && slot.assets.length > 1 ? (
            <div className="stack-sm">
              <span className="meta">切换此槽位素材</span>
              <div className="thumb-strip">
                {slot.assets.map((a) => (
                  <button
                    key={a.linkId}
                    type="button"
                    className="thumb"
                    onClick={() => onSelectAsset(a.id)}
                    aria-pressed={a.isSelected}
                    aria-label={`选择素材 ${a.filePath}`}
                  >
                    {a.url ? (
                      <RuntimeMedia
                        source={sourceFromAsset(a)}
                        mode="still"
                        badge={false}
                        emptyTitle="无预览"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="action-row">
            <Button variant="primary" size="sm" onClick={onUpload}>
              <Icon name="upload" size={14} />
              上传素材
            </Button>
            <Button variant="outline" size="sm" onClick={onGenerate}>
              <Icon name="spark" size={14} />
              前往生成
            </Button>
            {selected ? (
              <Button variant="ghost" size="sm" onClick={onReplace}>
                替换当前形象
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  /* 2. Studio-Only Concept State (Compact Architectural Card) */
  if (isConceptOnly) {
    return (
      <article className="gallery-card-compact">
        <div className="split">
          <h3 className="card-title">{def.name}</h3>
          <span className="mono">{def.stateKey}</span>
        </div>
        <p className="meta">{def.description}</p>
        <div className="split">
          <StatusMark tone="neutral" label="非独立槽位" />
          <Button variant="ghost" size="sm" onClick={() => setCompare((v) => !v)}>
            <Icon name="compare" size={13} />
            {compare ? '收起' : '对比本地'}
          </Button>
        </div>
        {compare ? (
          <div className="compare">
            <figure>
              <div className="media-11">
                <RuntimeMedia
                  source={selected ? sourceFromAsset(selected) : null}
                  badge={false}
                  emptyTitle="本地无素材"
                  emptyNote="该状态没有本地素材。"
                />
              </div>
              <figcaption>本地素材</figcaption>
            </figure>
            <figure>
              <div className="media-11">
                <RuntimeMedia
                  source={null}
                  badge={false}
                  emptyTitle={empty.title}
                  emptyNote={empty.note}
                  emptyIcon={empty.icon}
                />
              </div>
              <figcaption>Muse 运行时</figcaption>
            </figure>
          </div>
        ) : null}
      </article>
    )
  }

  /* 3. Live Runtime-Driven Exhibition Card */
  return (
    <article className="gallery-card">
      <div className="media-43">
        <RuntimeMedia
          source={source}
          badge={false}
          emptyTitle={empty.title}
          emptyNote={empty.note}
          emptyIcon={empty.icon}
          onActivate={(s) => onPreview(s, `${def.name} · ${s.label}`)}
        />
      </div>

      <div className="card-body">
        <div className="split">
          <div className="cluster" style={{ gap: 6 }}>
            <h3 className="card-title">{def.name}</h3>
            <Badge tone="good">自动驱动</Badge>
          </div>
          <span className="mono">{def.stateKey}</span>
        </div>
        <p className="meta">{def.description}</p>

        <div className="split" style={{ marginTop: 'auto', paddingTop: 4 }}>
          <StatusMark tone="accent" label="Muse 运行时 · 只读" />
          <Button variant="ghost" size="sm" onClick={() => setCompare((v) => !v)}>
            <Icon name="compare" size={14} />
            {compare ? '收起对照' : '对比本地'}
          </Button>
        </div>

        {compare ? (
          <div className="compare">
            <figure>
              <div className="media-11">
                <RuntimeMedia
                  source={selected ? sourceFromAsset(selected) : null}
                  badge={false}
                  emptyTitle="本地无素材"
                  emptyNote="该状态没有本地素材。"
                />
              </div>
              <figcaption>本地素材</figcaption>
            </figure>
            <figure>
              <div className="media-11">
                <RuntimeMedia
                  source={runtimeMedia ?? null}
                  badge={false}
                  emptyTitle={empty.title}
                  emptyNote={empty.note}
                  emptyIcon={empty.icon}
                />
              </div>
              <figcaption>Muse 运行时</figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </article>
  )
}
