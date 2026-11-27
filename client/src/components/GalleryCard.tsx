import { useState } from 'react'
import type { StateDefinition, StateSlot } from '../shared'
import { Icon } from './icons'
import { Badge, Button, StatusMark } from './ui'

/**
 * Gallery card — image-first, aspect 4/3, object-cover.
 * shared_base: only `base` is configurable. Other states show the
 * Muse runtime frame and stay read-only. Side-by-side compare is opt-in.
 */
export function GalleryCard({
  def,
  slot,
  runtimeFrameUrl,
  onPreview,
  onSelectAsset,
  onUpload,
  onGenerate,
  onCompare,
}: {
  def: StateDefinition
  slot: StateSlot | undefined
  runtimeFrameUrl?: string | null
  onPreview: (url: string, label: string) => void
  onSelectAsset: (assetId: string) => void
  onUpload: () => void
  onGenerate: () => void
  onCompare: () => void
}) {
  const [compare, setCompare] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const selected = slot?.assets.find((a) => a.isSelected) ?? slot?.assets[0]
  const isBase = def.stateKey === 'base'
  const imageUrl = isBase ? selected?.url : runtimeFrameUrl

  return (
    <article className="panel gallery-card">
      <div className="media-43">
        {imageUrl && failedUrl !== imageUrl ? (
          <button
            type="button"
            className="media-hit"
            onClick={() => onPreview(imageUrl, `${def.name} · ${isBase ? '当前素材' : 'Muse 运行时'}`)}
            aria-label={`高清预览 ${def.name}`}
          >
            <img className="media-img" src={imageUrl} alt={def.name} loading="lazy" onError={() => setFailedUrl(imageUrl)} />
          </button>
        ) : (
          <div className="media-empty">
            <Icon name={isBase ? 'image' : 'spark'} size={28} />
            <span className="card-title">{isBase ? '尚未配置' : '自动驱动'}</span>
          </div>
        )}
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
                {a.url ? <img src={a.url} alt="" /> : null}
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
                <Button variant="ghost" size="sm" onClick={onCompare}>替换</Button>
              ) : null}
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCompare((v) => !v)
                onCompare()
              }}
            >
              <Icon name="compare" size={14} />
              {compare ? '收起对照' : '对比本地素材'}
            </Button>
          )}
        </div>
        {compare && !isBase && selected?.url && runtimeFrameUrl ? (
          <div className="compare">
            <figure>
              <img src={selected.url} alt="本地素材" />
              <figcaption className="meta">本地素材</figcaption>
            </figure>
            <figure>
              <img src={runtimeFrameUrl} alt="Muse 运行时" />
              <figcaption className="meta">Muse 运行时</figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </article>
  )
}
