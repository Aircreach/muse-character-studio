import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, profileKey } from '../api'
import { useTheme } from '../hooks/useTheme'
import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Button, EmptyState, LoadingNote } from './ui'
import { PreviewDialog } from './PreviewDialog'
import { RuntimeMedia, sourceFromCoverUrl, type RuntimeMediaSource } from './RuntimeMedia'

export type StudioBackdrop = 'white' | 'matte' | 'black'

const STAGE_STATES: Array<{ key: string; idx: string; label: string }> = [
  { key: 'idle', idx: '01', label: '待机' },
  { key: 'waking', idx: '02', label: '唤醒' },
  { key: 'working', idx: '03', label: '工作' },
  { key: 'making_something', idx: '04', label: '制作中' },
  { key: 'milestone_level_up', idx: '05', label: '里程碑' },
  { key: 'base_portrait', idx: '06', label: '基准原图' },
]

/**
 * ExhibitionHome — Full-bleed Spatial Exhibition Stage.
 * Synthesizes Jesper Landberg's infinite perspective floor & 4-corner quiet HUD,
 * Thomas Mamfredas's monumental bottom-left editorial scale contrast, and the
 * Aircreach · [Black Rock] hollow-world checkerboard + electric azure soul star.
 */
export function ExhibitionHome({
  profiles,
  activeProfileId,
  runtimeMap,
  loading,
  error,
  onOpenWorkspace,
  onOpenLibrary,
  onOpenCreate,
}: {
  profiles: CharacterProfile[]
  activeProfileId: string | null
  runtimeMap: Map<string, RuntimeMediaSource>
  loading: boolean
  error: boolean
  onOpenWorkspace: (id: string) => void
  onOpenLibrary: () => void
  onOpenCreate: () => void
}) {
  const { theme } = useTheme()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stageState, setStageState] = useState<string>('idle')
  const [switching, setSwitching] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const stageRef = useRef<HTMLElement>(null)

  // Silky rAF-lerped spatial parallax (zero React re-renders, respects reduced-motion)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let rafId = 0

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }
    const onLeave = () => {
      targetX = 0
      targetY = 0
    }

    const tick = () => {
      currentX += (targetX - currentX) * 0.08
      currentY += (targetY - currentY) * 0.08
      el.style.setProperty('--px', currentX.toFixed(4))
      el.style.setProperty('--py', currentY.toFixed(4))
      rafId = window.requestAnimationFrame(tick)
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    rafId = window.requestAnimationFrame(tick)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  const featured = useMemo(() => {
    if (profiles.length === 0) return null
    if (selectedId) {
      const match = profiles.find((p) => p.id === selectedId)
      if (match) return match
    }
    return (
      profiles.find((p) => p.id === activeProfileId) ??
      profiles.find((p) => p.favorite && !p.archivedAt) ??
      profiles.find((p) => !p.archivedAt) ??
      profiles[0]
    )
  }, [activeProfileId, profiles, selectedId])

  const detail = useQuery({
    queryKey: featured ? profileKey(featured.id) : ['profile', 'none'],
    queryFn: () => api.getProfileDetail({ id: featured!.id }),
    enabled: Boolean(featured),
  })

  const availableStates = useMemo(
    () => STAGE_STATES.filter((s) => s.key === 'base_portrait' || runtimeMap.has(s.key)),
    [runtimeMap],
  )

  const stageSource = useMemo(() => {
    if (stageState !== 'base_portrait') {
      const live = runtimeMap.get(stageState)
      if (live) return live
    }
    const baseSelected = detail.data?.slots.find((s) => s.stateKey === 'base')?.assets.find((a) => a.isSelected)
    const fallbackUrl = baseSelected?.url ?? featured?.coverUrl ?? '/assets/runtime/base.webp'
    return sourceFromCoverUrl(fallbackUrl, `${featured?.name ?? 'Muse'} 主视觉`)
  }, [detail.data, featured, runtimeMap, stageState])

  const handleStateSwitch = (nextKey: string) => {
    if (nextKey === stageState) return
    setSwitching(true)
    window.setTimeout(() => {
      setStageState(nextKey)
      setSwitching(false)
    }, 110)
  }

  if (loading) return <LoadingNote>正在开启展厅…</LoadingNote>

  if (error) {
    return (
      <div className="archive-canvas">
        <EmptyState title="展厅连接失败" body="请确认本地后端服务正在运行后刷新重试。" />
      </div>
    )
  }

  if (!featured) {
    return (
      <div className="archive-canvas">
        <EmptyState
          title="展厅尚无陈列角色"
          body="创建第一张角色卡，开始管理你的 Muse 形象与人格档案。"
          action={
            <Button variant="primary" onClick={onOpenCreate}>
              <Icon name="plus" size={15} />
              新建角色卡
            </Button>
          }
        />
      </div>
    )
  }

  const isActive = featured.id === activeProfileId
  const currentStage = availableStates.find((s) => s.key === stageState) ?? availableStates[0]
  const ghostLabel = theme === 'blackrock' ? 'BLACK★ROCK' : featured.name

  return (
    <section ref={stageRef} className="exhibit-stage" aria-label="当前焦点角色展厅">
      {/* Infinite 3D Perspective Grid / Hollow World Checkered Horizon */}
      <div className="perspective-floor" aria-hidden />

      {/* Backdrop Architectural Layer: Flame Halo + Elongated BRS Star + Ghost Type */}
      <div className="stage-backdrop-art" aria-hidden>
        <div className="stage-flame-halo" />
        <div className="stage-star-orbit">
          <Icon name="brsStar" size={560} className="w-full h-full" />
        </div>
        <span className="stage-ghost-type">{ghostLabel}</span>
      </div>

      {/* Center Monumental Uncropped Character Stage */}
      <div className="exhibit-figure" data-switching={switching ? 'true' : 'false'}>
        <RuntimeMedia
          source={stageSource}
          badge={false}
          emptyTitle="暂无画面"
          emptyNote="进入画室上传基础形象或检查运行时媒体。"
        />
      </div>

      {/* Bottom-Left Monumental Editorial Headline (Thomas Mamfredas Scale Contrast) */}
      <div className="exhibit-headline">
        <div className="exhibit-kicker">
          <span className="exhibit-kicker-dot" aria-hidden />
          <span>{isActive ? 'ACTIVE PERSONA // 当前激活' : 'EXHIBITION FOCUS // 展厅焦点'}</span>
        </div>
        <h1 className="exhibit-title">{featured.name}</h1>
        <div className="exhibit-subrow">
          {featured.subtitle ? <span className="exhibit-subtitle">{featured.subtitle}</span> : null}
          <span className="mono">
            {currentStage ? `${currentStage.idx} · ${currentStage.label}` : 'LIVE'}
          </span>
        </div>
        <p className="exhibit-quote">
          {featured.description?.trim() || '完整融合角色视觉画廊与结构化人格设定的专属 Muse 档案。'}
        </p>
        <div className="exhibit-actions">
          <Button
            variant={theme === 'blackrock' ? 'accent' : 'primary'}
            onClick={() => onOpenWorkspace(featured.id)}
          >
            进入画室
          </Button>
          <Button variant="outline" onClick={onOpenLibrary}>
            全部档案 ({profiles.length})
          </Button>
        </div>
      </div>

      {/* Right-Edge Vertical Live State Rail */}
      <nav className="exhibit-rail" aria-label="切换角色实时动态状态">
        {availableStates.map((s) => (
          <button
            key={s.key}
            type="button"
            className="rail-step"
            aria-pressed={stageState === s.key}
            onClick={() => handleStateSwitch(s.key)}
          >
            <span className="rail-num">{s.idx}</span>
            <span>{s.label}</span>
            <span className="rail-tick" aria-hidden />
          </button>
        ))}
      </nav>

      {/* Bottom 2-Corner Perimeter Bar */}
      <div className="exhibit-bottom">
        <div className="persona-strip" role="group" aria-label="切换展厅陈列角色">
          {profiles
            .filter((p) => !p.archivedAt)
            .map((p, idx) => (
              <button
                key={p.id}
                type="button"
                className="persona-tab"
                aria-pressed={p.id === featured.id}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="mono">{String(idx + 1).padStart(2, '0')}</span>
                <span>{p.subtitle || p.name}</span>
              </button>
            ))}
        </div>

        <div className="cluster" style={{ gap: 16 }}>
          <span className="mono">ID {featured.id.slice(-6).toUpperCase()}</span>
          <button
            type="button"
            className="hud-action-text"
            aria-label="全屏检视当前画面"
            onClick={() => setLightboxOpen(true)}
          >
            <Icon name="expand" size={13} />
            <span>全屏检视</span>
          </button>
        </div>
      </div>

      <PreviewDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        source={stageSource}
        label={`${featured.name}${featured.subtitle ? ` · ${featured.subtitle}` : ''} — ${currentStage?.label ?? '展陈'}`}
      />
    </section>
  )
}
