import { useState } from 'react'
import type { StateDefinition, StateSlot } from '../shared'
import { Badge, Button, StatusMark } from './ui'

/**
 * Gallery card — image-first. The old layout (two equal grey
 * aspect-square boxes side by side, “当前素材” / “Muse 运行时”) is gone.
 *
 * shared_base:
 * - base slot shows the selected local asset, full-bleed.
 * - every other state shows Muse's real runtime frame, labelled
 *   “自动驱动 · Muse 运行时”, and never asks the user to configure it.
 * - an unconfigured local asset is never presented as the Muse image.
 * A local-vs-runtime side-by-side comparison is shown only when the
 * user explicitly asks for it (compare mode).
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
  const selected = slot?.assets.find((a) => a.isSelected) ?? slot?.assets[0]
  const isBase = def.stateKey === 'base'
  const imageUrl = isBase ? selected?.url : runtimeFrameUrl

  return (
    <article className="card overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-[var(--color-surface-3)]">
        {imageUrl ? (
          <button
            type="button"
            onClick={() => onPreview(imageUrl, `${def.name} · ${isBase ? '当前素材' : 'Muse 运行时'}`)}
            className="block size-full"
            aria-label={`高清预览 ${def.name}`}
          >
            <img src={imageUrl} alt={def.name} className="size-full object-cover" loading="lazy" />
          </button>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-sm font-medium text-[var(--color-ink-2)]">
              {isBase ? '尚未配置基础形象' : 'Muse 自动驱动'}
            </span>
            <span className="text-xs text-[var(--color-ink-3)]">
              {isBase ? '上传或生成一张基础形象后，这里才会显示。' : '该状态由 Muse 内部动画生成，无需手动配图。'}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {isBase ? <Badge tone="accent">可配置</Badge> : <Badge tone="good">自动驱动</Badge>}
          {def.required ? <Badge>必需</Badge> : null}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">{def.name}</h3>
          <span className="shrink-0 text-xs text-[var(--color-ink-4)]">{def.stateKey}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-3)]">{def.description}</p>
        <div className="mt-3">
          {isBase ? (
            <StatusMark
              tone={selected ? 'good' : 'warn'}
              label={selected ? `已选素材 · ${slot?.assets.length ?? 0} 张候选` : '未选素材'}
            />
          ) : (
            <StatusMark tone="accent" label="Muse 运行时表现 · 只读" />
          )}
        </div>

        {isBase && slot && slot.assets.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {slot.assets.map((a) => (
              <button
                key={a.linkId}
                type="button"
                onClick={() => onSelectAsset(a.id)}
                aria-pressed={a.isSelected}
                className={`relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 ${
                  a.isSelected ? 'border-[var(--color-accent)]' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
              >
                {a.url ? <img src={a.url} alt="" className="size-full object-cover" /> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {isBase ? (
            <>
              <Button variant="outline" onClick={onUpload}>上传</Button>
              <Button variant="outline" onClick={onGenerate}>生成</Button>
              {selected ? <Button variant="ghost" onClick={onCompare}>替换</Button> : null}
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                setCompare((v) => !v)
                onCompare()
              }}
            >
              {compare ? '收起对照' : '对比本地素材'}
            </Button>
          )}
        </div>
        {compare && !isBase && selected?.url && runtimeFrameUrl ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <figure>
              <img src={selected.url} alt="本地素材" className="aspect-square w-full rounded-[var(--radius-md)] object-cover" />
              <figcaption className="mt-1 text-center text-xs text-[var(--color-ink-3)]">本地素材</figcaption>
            </figure>
            <figure>
              <img src={runtimeFrameUrl} alt="Muse 运行时" className="aspect-square w-full rounded-[var(--radius-md)] object-cover" />
              <figcaption className="mt-1 text-center text-xs text-[var(--color-ink-3)]">Muse 运行时</figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </article>
  )
}
