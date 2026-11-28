import { useState } from 'react'
import type { StateDefinition, StateSlot } from '../shared'
import { Icon } from './icons'
import { Badge, Button, StatusMark } from './ui'
import { mediaKindFromUrl, RuntimeMedia, sourceFromAsset, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * Gallery card — media-first, aspect 4/3, object-cover.
 * shared_base: only `base` is configurable. Other states show the real
 * Muse runtime media (video where a video exists, frame otherwise) and
 * stay read-only. Side-by-side compare is opt-in.
 *
 * Every state renders through RuntimeMedia: video plays, image shows,
 * and a state with no media gets a labelled placeholder — never a black
 * box, never the base image pretending to be that state's frame.
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
  /** 该状态的真实运行时媒体（getRuntimeAssets 的 items 元素）；没有时为 null。 */
  runtimeMedia?: RuntimeMediaSource | null
  onPreview: (url: string, label: string) => void
  onSelectAsset: (assetId: string) => void
  onUpload: () => void
  onGenerate: () => void
  /** 替换基础形象：上传一个新文件并把它选为当前素材（真实行为，见 Workspace）。 */
  onReplace: () => void
}) {
  const [compare, setCompare] = useState(false)
  const selected = slot?.assets.find((a) => a.isSelected) ?? slot?.assets[0]
  const isBase = def.stateKey === 'base'
  const source: RuntimeMediaSource | null = isBase
    ? selected
      ? sourceFromAsset(selected)
      : null
    : (runtimeMedia ?? null)
  const empty = isBase
    ? { title: '尚未配置', note: '上传或生成一张基础形象后，这里才会显示。', icon: 'image' as const }
    : def.runtimeStateKey
      ? {
          title: '暂无运行时画面',
          note: '本地没有该状态的真实媒体：把帧或视频放到 server/data/runtime-media/ 后会显示。',
          icon: 'spark' as const,
        }
      : {
          title: '非独立槽位',
          note: '该状态由 Muse 内部动画派生，没有独立画面。',
          icon: 'layers' as const,
        }

  return (
    <article className="panel gallery-card">
      <div className="media-43">
        <RuntimeMedia
          source={source}
          emptyTitle={empty.title}
          emptyNote={empty.note}
          emptyIcon={empty.icon}
          onActivate={(s) => onPreview(s.url, `${def.name} · ${s.label}`)}
        />
        <div className="media-badges">
          {isBase ? <Badge tone="accent">可配置</Badge> : <Badge tone="good">自动驱动</Badge>}
          {def.required ? <Badge>必需</Badge> : null}
        </div>
      </div>

      <div className="card-body">
        <div className="split">
          <h3 className="card-title">{def.name}</h3>
          <span className="mono">{def.stateKey}</span>
        </div>
        <p className="meta">{def.description}</p>
        {isBase ? (
          <StatusMark
            tone={selected ? 'good' : 'warn'}
            label={selected ? `已选素材 · ${slot?.assets.length ?? 0} 张候选` : '未选素材'}
          />
        ) : (
          <StatusMark tone="accent" label="Muse 运行时表现 · 只读" />
        )}

        {isBase && slot && slot.assets.length > 1 ? (
          <div className="thumb-strip">
            {slot.assets.map((a) => (
              <button
                key={a.linkId}
                type="button"
                className="thumb"
                onClick={() => onSelectAsset(a.id)}
                aria-pressed={a.isSelected}
              >
                {a.url ? (
                  mediaKindFromUrl(a.url) === 'video' ? (
                    <video src={a.url} muted preload="metadata" />
                  ) : (
                    <img src={a.url} alt="" />
                  )
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="action-row">
          {isBase ? (
            <>
              <Button variant="outline" size="sm" onClick={onUpload}><Icon name="upload" size={14} />上传</Button>
              <Button variant="outline" size="sm" onClick={onGenerate}><Icon name="spark" size={14} />生成</Button>
              {selected ? (
                <Button variant="ghost" size="sm" onClick={onReplace}>替换</Button>
              ) : null}
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setCompare((v) => !v)}>
              <Icon name="compare" size={14} />
              {compare ? '收起对照' : '对比本地素材'}
            </Button>
          )}
        </div>
        {compare && !isBase ? (
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
              <figcaption className="meta">本地素材</figcaption>
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
              <figcaption className="meta">Muse 运行时</figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </article>
  )
}
