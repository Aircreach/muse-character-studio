import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from './icons'
import { RuntimeMedia, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * Interactive Split-Curtain Compare Slider (Pro imaging software craft).
 * Uses GPU-accelerated clip-path: inset() with pointer capture for smooth scrubbing
 * between the character's local asset and Muse's live runtime media.
 */
export function SplitCompareStage({
  localSource,
  runtimeSource,
  runtimeEmptyTitle,
  runtimeEmptyNote,
}: {
  localSource: RuntimeMediaSource | null
  runtimeSource: RuntimeMediaSource | null
  runtimeEmptyTitle: string
  runtimeEmptyNote: string
}) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.min(96, Math.max(4, next)))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }

  const onPointerUp = () => {
    dragging.current = false
  }

  return (
    <div
      ref={containerRef}
      className="split-compare-stage"
      role="slider"
      aria-label="左右拖动对比本地素材与 Muse 运行时"
      aria-valuemin={4}
      aria-valuemax={96}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setPos((v) => Math.max(4, v - 5))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setPos((v) => Math.min(96, v + 5))
        }
      }}
    >
      {/* Underlay: Muse Runtime */}
      <div className="split-layer split-layer-runtime">
        <RuntimeMedia
          source={runtimeSource}
          badge={false}
          emptyTitle={runtimeEmptyTitle}
          emptyNote={runtimeEmptyNote}
        />
      </div>

      {/* Overlay: Local Asset clipped from the right */}
      <div className="split-layer split-layer-local" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <RuntimeMedia
          source={localSource}
          badge={false}
          emptyTitle="本地无对照素材"
          emptyNote="该状态尚未在本地保存独立对照素材。"
        />
      </div>

      <div className="split-divider" style={{ left: `${pos}%` }} aria-hidden>
        <span className="split-handle">
          <Icon name="compare" size={14} />
        </span>
      </div>

      <span className="split-tag split-tag-left">本地素材</span>
      <span className="split-tag split-tag-right">Muse 运行时</span>
    </div>
  )
}
