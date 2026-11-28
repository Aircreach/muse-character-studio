import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, profileKey } from './api'
import { useTheme } from './hooks/useTheme'
import type { Asset, Capabilities, CharacterProfile } from './shared'
import { Icon } from './components/icons'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  LoadingNote,
  Modal,
  Notice,
  Segmented,
  TextArea,
  TextInput,
} from './components/ui'
import { ConfirmDialog } from './components/ConfirmDialog'
import type { StudioBackdrop } from './components/ExhibitionHome'
import { GalleryCard } from './components/GalleryCard'
import { GeneratePanel } from './components/GeneratePanel'
import { PreviewDialog } from './components/PreviewDialog'
import { RuntimeMedia, sourceFromAsset, type RuntimeMediaSource } from './components/RuntimeMedia'
import { SettingsForm } from './components/SettingsForm'
import { SplitCompareStage } from './components/SplitCompareStage'

type Tab = 'gallery' | 'settings' | 'generate' | 'references'
type GalleryMode = 'loupe' | 'contact'

const TABS: Array<{ value: Tab; num: string; label: string }> = [
  { value: 'gallery', num: '01', label: '展陈图集' },
  { value: 'settings', num: '02', label: '人格手稿' },
  { value: 'generate', num: '03', label: '影像工坊' },
  { value: 'references', num: '04', label: '参考墙' },
]

/**
 * Character Monograph & Optical Studio (画室).
 * Synthesizes Jesper Landberg & Gil Huybrecht's 1/3 sticky editorial spine +
 * 2/3 unframed exhibition canvas, a live radial scroll-progress ring, Capture One
 * optical Loupe & Split-Curtain compare slider, and Gil Huybrecht spotlight contact sheet.
 */
export function Workspace({
  profileId,
  capabilities,
  onBack,
  onOpenProfile,
  onToast,
}: {
  profileId: string
  capabilities: Capabilities | null
  onBack: () => void
  onOpenProfile: (id: string) => void
  onToast: (msg: string) => void
}) {
  const qc = useQueryClient()
  const { dark } = useTheme()
  const [tab, setTab] = useState<Tab>('gallery')
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('loupe')
  const [selectedStateKey, setSelectedStateKey] = useState<string>('idle')
  const [backdrop, setBackdrop] = useState<StudioBackdrop>(() => (dark ? 'black' : 'white'))
  const [splitCompare, setSplitCompare] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)
  const [preview, setPreview] = useState<{ source: RuntimeMediaSource; label: string } | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    body: string
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileMode = useRef<'add' | 'replace'>('add')
  const uploadTargetKey = useRef<string>('base')

  useEffect(() => {
    setBackdrop(dark ? 'black' : 'white')
  }, [dark])

  // Jesper Landberg-inspired live radial scroll ring listener
  useEffect(() => {
    const updateScroll = () => {
      const doc = document.documentElement
      const max = Math.max(doc.scrollHeight - window.innerHeight, 0)
      if (max <= 4) {
        setScrollPct(100)
        return
      }
      setScrollPct(Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))))
    }
    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('resize', updateScroll)
    }
  }, [tab, galleryMode, profileId])

  const detail = useQuery({
    queryKey: profileKey(profileId),
    queryFn: () => api.getProfileDetail({ id: profileId }),
  })

  const runtimeAssets = useQuery({
    queryKey: ['runtime-assets'],
    queryFn: () => api.getRuntimeAssets({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const runtimeMedia = useMemo(() => {
    const map = new Map<string, RuntimeMediaSource>()
    for (const item of runtimeAssets.data?.items ?? []) {
      map.set(item.stateKey, {
        kind: item.kind,
        url: item.url,
        posterUrl: item.posterUrl,
        darkUrl: item.darkUrl,
        label: item.label,
        alt: item.stateKey,
      })
    }
    return map
  }, [runtimeAssets.data])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: profileKey(profileId) })
    qc.invalidateQueries({ queryKey: ['studio'] })
  }

  const saveSettings = useMutation({
    mutationFn: (patch: Parameters<typeof api.saveSettings>[0]['patch']) =>
      api.saveSettings({ profileId, patch }),
    onSuccess: () => {
      invalidate()
      onToast('设定已保存')
    },
    onError: (e) => onToast(`保存失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const updateProfile = useMutation({
    mutationFn: (input: { name: string; subtitle: string; description: string; tags: string[] }) =>
      api.updateProfile({ id: profileId, ...input }),
    onSuccess: () => {
      invalidate()
      setEditOpen(false)
      onToast('角色资料已更新')
    },
    onError: (e) => onToast(`更新失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const activate = useMutation({
    mutationFn: () => api.activateProfile({ profileId }),
    onSuccess: (res) => {
      invalidate()
      setActivationNote(
        `已激活（本地记录 ${res.activation.id.slice(0, 8)}…）。运行时头像同步仍走独立候选流程，本次未改 Muse 头像。`,
      )
      onToast('角色已激活')
    },
    onError: (e) => onToast(`激活失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const deactivate = useMutation({
    mutationFn: () => api.deactivateProfile({}),
    onSuccess: () => {
      invalidate()
      setActivationNote(null)
      onToast('已解除当前激活')
    },
    onError: (e) => onToast(`解除激活失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const importBase = useMutation({
    mutationFn: () => api.importRuntimeBase({ profileId }),
    onSuccess: (res) => {
      invalidate()
      onToast(res.alreadyPresent ? '已选定既有运行时原图作为基础形象' : '已导入内置运行时原图作为基础形象')
    },
    onError: (e) => onToast(`导入失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const duplicate = useMutation({
    mutationFn: () => api.duplicateProfile({ id: profileId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['studio'] })
      setDrawerOpen(false)
      onToast('已复制角色卡（共享素材不复制文件）')
      onOpenProfile(res.profile.id)
    },
    onError: (e) => onToast(`复制失败：${e instanceof Error ? e.message : '未知错误'}`),
  })

  const generate = useMutation({
    mutationFn: (v: { stateKey: string; stateBrief: string; extra: string }) =>
      api.generateAsset({ profileId, ...v }),
    onSuccess: () => {
      invalidate()
      onToast('已生成候选，请在影像工坊审核采纳')
    },
    onError: (error) => onToast(`生成失败：${error instanceof Error ? error.message : '未知错误'}`),
  })

  const adopt = useMutation({
    mutationFn: (v: { candidateId: string; stateKey: string }) => api.adoptCandidate({ profileId, ...v }),
    onSuccess: () => {
      invalidate()
      onToast('候选已加入画廊')
    },
    onError: (error) => onToast(`采纳失败：${error instanceof Error ? error.message : '未知错误'}`),
  })

  useEffect(() => {
    setTab('gallery')
    setSelectedStateKey('idle')
    setSplitCompare(false)
    setActivationNote(null)
    setEditOpen(false)
    setDrawerOpen(false)
  }, [profileId])

  useEffect(() => {
    setSplitCompare(false)
  }, [selectedStateKey])

  const d = detail.data

  const orderedDefs = useMemo(() => {
    if (!d) return { base: [], runtime: [], concept: [], all: [] }
    const base = d.stateDefs.filter((def) => def.configurable || def.stateKey === 'base')
    const runtime = d.stateDefs.filter((def) => !def.configurable && def.stateKey !== 'base' && Boolean(def.runtimeStateKey))
    const concept = d.stateDefs.filter((def) => !def.configurable && def.stateKey !== 'base' && !def.runtimeStateKey)
    return { base, runtime, concept, all: [...base, ...runtime, ...concept] }
  }, [d])

  // Keyboard arrow scrubbing in Loupe mode
  useEffect(() => {
    if (tab !== 'gallery' || galleryMode !== 'loupe' || orderedDefs.all.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (drawerOpen || editOpen || preview != null || confirm != null) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = orderedDefs.all.findIndex((item) => item.stateKey === selectedStateKey)
        if (idx === -1) return
        const nextIdx =
          e.key === 'ArrowRight'
            ? (idx + 1) % orderedDefs.all.length
            : (idx - 1 + orderedDefs.all.length) % orderedDefs.all.length
        setSelectedStateKey(orderedDefs.all[nextIdx].stateKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, drawerOpen, editOpen, galleryMode, orderedDefs.all, preview, selectedStateKey, tab])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  if (detail.isLoading) return <LoadingNote>正在打开角色专刊画室…</LoadingNote>
  if (detail.isError || !d) {
    return (
      <div className="archive-canvas">
        <EmptyState
          title="角色加载失败"
          body="无法读取该角色卡详情，请返回档案库重试。"
          action={
            <Button variant="outline" onClick={onBack}>
              返回档案
            </Button>
          }
        />
      </div>
    )
  }

  const baseSlot = d.slots.find((s) => s.stateKey === 'base')
  const activeDef = orderedDefs.all.find((def) => def.stateKey === selectedStateKey) ?? orderedDefs.all[0]
  const activeSlot = d.slots.find((s) => s.stateKey === activeDef?.stateKey)
  const activeSlotSelected = activeSlot?.assets.find((a) => a.isSelected) ?? activeSlot?.assets[0]
  const activeIsConfigurable = Boolean(activeDef?.configurable) || activeDef?.stateKey === 'base'
  const activeRuntimeSource = activeDef?.runtimeStateKey ? runtimeMedia.get(activeDef.runtimeStateKey) ?? null : null
  const activeLoupeSource: RuntimeMediaSource | null = activeIsConfigurable
    ? activeSlotSelected
      ? sourceFromAsset(activeSlotSelected)
      : null
    : activeRuntimeSource

  const activeEmpty = activeIsConfigurable
    ? { title: '尚未配置基础形象', note: '上传图片/视频，或一键导入内置运行时原图。', icon: 'image' as const }
    : activeDef?.runtimeStateKey
      ? { title: '暂无运行时画面', note: '将真实媒体放入 server/data/runtime-media/ 后自动展示。', icon: 'film' as const }
      : { title: '非独立运行时槽位', note: '由 Muse 内部动画派生，无独立媒体文件。', icon: 'layers' as const }

  const triggerUpload = (stateKey: string, mode: 'add' | 'replace') => {
    uploadTargetKey.current = stateKey
    fileMode.current = mode
    fileRef.current?.click()
  }

  const onUploadFile = async (file: File) => {
    const mode = fileMode.current
    const targetKey = uploadTargetKey.current
    fileMode.current = 'add'
    try {
      await api.uploadAsset({ profileId, stateKey: targetKey, file, select: mode === 'replace' })
      invalidate()
      onToast(mode === 'replace' ? '已替换当前槽位形象' : '素材已上传')
    } catch (e) {
      onToast(`上传失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.exportProfile({ profileId })
      const blob = new Blob([res.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${d.profile.name}-${d.profile.subtitle || d.profile.id.slice(-6)}.muse-profile.json`
      a.click()
      URL.revokeObjectURL(url)
      onToast('已导出角色档案 JSON（不含素材字节）')
    } catch (e) {
      onToast(`导出失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const renderGalleryCard = (def: (typeof d.stateDefs)[number]) => (
    <GalleryCard
      key={def.stateKey}
      def={def}
      slot={d.slots.find((s) => s.stateKey === def.stateKey)}
      runtimeMedia={def.runtimeStateKey ? runtimeMedia.get(def.runtimeStateKey) ?? null : null}
      onPreview={(source, label) => setPreview({ source, label })}
      onSelectAsset={async (assetId) => {
        try {
          await api.selectAsset({ profileId, stateKey: def.stateKey, assetId })
          invalidate()
        } catch (error) {
          onToast(`选择失败：${error instanceof Error ? error.message : '未知错误'}`)
        }
      }}
      onUpload={() => triggerUpload(def.stateKey, 'add')}
      onGenerate={() => setTab('generate')}
      onReplace={() => triggerUpload(def.stateKey, 'replace')}
    />
  )

  const renderFilmTile = (def: (typeof d.stateDefs)[number]) => {
    const slot = d.slots.find((s) => s.stateKey === def.stateKey)
    const sel = slot?.assets.find((a) => a.isSelected) ?? slot?.assets[0]
    const isCfg = def.configurable || def.stateKey === 'base'
    const rt = def.runtimeStateKey ? runtimeMedia.get(def.runtimeStateKey) ?? null : null
    const thumbSource = isCfg ? (sel ? sourceFromAsset(sel) : null) : rt
    const dotTone = isCfg ? (sel ? 'dot-good' : 'dot-warn') : def.runtimeStateKey ? 'dot-accent' : 'dot-neutral'
    return (
      <button
        key={def.stateKey}
        type="button"
        className="film-tile"
        aria-current={activeDef?.stateKey === def.stateKey ? 'true' : undefined}
        onClick={() => setSelectedStateKey(def.stateKey)}
      >
        <div className="film-thumb">
          {thumbSource ? (
            <RuntimeMedia source={thumbSource} mode="still" badge={false} emptyTitle="" />
          ) : (
            <div className="film-empty">
              <Icon name={isCfg ? 'image' : 'layers'} size={15} />
            </div>
          )}
        </div>
        <div className="film-label">
          <span className="ellipsis">{def.name}</span>
          <span className={`film-dot ${dotTone}`} aria-hidden />
        </div>
      </button>
    )
  }

  const ringCircumference = 2 * Math.PI * 10
  const ringOffset = ringCircumference * (1 - scrollPct / 100)

  const tabMeta: Record<Tab, string> = {
    gallery: `${orderedDefs.all.length} 状态`,
    settings: '7 章节',
    generate: `${d.candidates.length} 候选`,
    references: `${d.references.length} 参考`,
  }

  return (
    <div className="monograph-shell">
      {/* LEFT 1/3 STICKY CURATORIAL SPINE */}
      <aside className="monograph-spine" aria-label="角色专刊侧栏">
        <div className="spine-top">
          <div className="spine-back-row">
            <button type="button" className="hud-action-text" onClick={onBack}>
              <Icon name="arrowLeft" size={14} />
              <span>返回档案库</span>
            </button>
            <div className="cluster" style={{ gap: 10 }}>
              <button
                type="button"
                className="hud-action-text"
                aria-label="编辑角色资料"
                title="编辑角色资料"
                onClick={() => setEditOpen(true)}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                className="hud-action-text"
                aria-label="档案与技术信息"
                title="档案与技术信息"
                onClick={() => setDrawerOpen(true)}
              >
                <Icon name="sliders" size={14} />
              </button>
            </div>
          </div>

          <div className="stack-sm">
            <div className="cluster" style={{ gap: 6 }}>
              {d.isActive ? <Badge tone="accent">当前激活 · 本地记录</Badge> : <Badge>未激活</Badge>}
              {d.profile.archivedAt ? <Badge tone="warn">已归档</Badge> : null}
            </div>

            <h1 className="active-profile-title">
              {d.profile.name}
              {d.profile.subtitle ? <span className="title-aside">{d.profile.subtitle}</span> : null}
            </h1>

            <p className="prose">
              {d.profile.description?.trim() || '尚未填写人格摘要，点击上方编辑图标补充。'}
            </p>

            {d.profile.tags.length > 0 ? (
              <div className="cluster" style={{ gap: 6 }}>
                {d.profile.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="action-row">
            {d.isActive ? (
              <Button
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                onClick={() => deactivate.mutate()}
                disabled={deactivate.isPending}
              >
                {deactivate.isPending ? '解除中…' : '解除激活'}
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                style={{ flex: 1 }}
                onClick={() => activate.mutate()}
                disabled={activate.isPending || Boolean(d.profile.archivedAt)}
              >
                {activate.isPending ? '激活中…' : '激活此角色'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
              档案抽屉
            </Button>
          </div>

          <nav className="spine-nav" aria-label="专刊章节切换">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                className="spine-nav-btn"
                aria-current={tab === t.value ? 'page' : undefined}
                onClick={() => setTab(t.value)}
              >
                <span className="spine-nav-left">
                  <span className="spine-nav-num">{t.num}</span>
                  <span>{t.label}</span>
                </span>
                <span className="mono">{tabMeta[t.value]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Jesper Landberg Signature Bottom-Left Radial Scroll Progress Ring */}
        <div className="spine-foot">
          <div className="scroll-ring-wrap" aria-label={`页面阅读进度 ${scrollPct}%`}>
            <svg className="scroll-ring" viewBox="0 0 26 26" aria-hidden>
              <circle className="scroll-ring-track" cx="13" cy="13" r="10" />
              <circle
                className="scroll-ring-fill"
                cx="13"
                cy="13"
                r="10"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <span>{String(scrollPct).padStart(3, '0')}%</span>
          </div>
          <span className="mono">ID {d.profile.id.slice(-6).toUpperCase()}</span>
        </div>
      </aside>

      {/* RIGHT 2/3 EDITORIAL MONOGRAPH CANVAS */}
      <div className="monograph-canvas">
        {activationNote ? <Notice tone="good">{activationNote}</Notice> : null}

        {/* CHAPTER 01: EXHIBITION GALLERY (LOUPE & CONTACT SHEET) */}
        {tab === 'gallery' ? (
          galleryMode === 'loupe' && activeDef ? (
            <div className="stack" style={{ gap: 20 }}>
              <div className="loupe-bar">
                <Segmented
                  ariaLabel="切换检视模式"
                  value={galleryMode}
                  onChange={(v) => setGalleryMode(v as GalleryMode)}
                  options={[
                    { value: 'loupe', label: '单图检视' },
                    { value: 'contact', label: '全览印样', icon: 'grid' },
                  ]}
                />

                <div className="cluster" style={{ gap: 10 }}>
                  {!activeIsConfigurable ? (
                    <Button
                      variant={splitCompare ? 'accent' : 'outline'}
                      size="sm"
                      onClick={() => setSplitCompare((v) => !v)}
                    >
                      <Icon name="compare" size={13} />
                      {splitCompare ? '退出卷帘对照' : '卷帘对照'}
                    </Button>
                  ) : null}

                  {activeLoupeSource ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPreview({
                          source: activeLoupeSource,
                          label: `${activeDef.name} · ${activeLoupeSource.label}`,
                        })
                      }
                    >
                      <Icon name="expand" size={13} />
                      全屏放大
                    </Button>
                  ) : null}

                  <div className="cluster" style={{ gap: 6 }} role="group" aria-label="画布背景光幕">
                    <button
                      type="button"
                      className="swatch swatch-white"
                      aria-label="纯白背景"
                      aria-pressed={backdrop === 'white'}
                      onClick={() => setBackdrop('white')}
                    />
                    <button
                      type="button"
                      className="swatch swatch-matte"
                      aria-label="画廊灰背景"
                      aria-pressed={backdrop === 'matte'}
                      onClick={() => setBackdrop('matte')}
                    />
                    <button
                      type="button"
                      className="swatch swatch-black"
                      aria-label="纯黑暗房背景"
                      aria-pressed={backdrop === 'black'}
                      onClick={() => setBackdrop('black')}
                    />
                  </div>
                </div>
              </div>

              {/* Optical Loupe Viewport */}
              <div className="loupe-stage-box" data-backdrop={backdrop}>
                {splitCompare && !activeIsConfigurable ? (
                  <SplitCompareStage
                    localSource={activeSlotSelected ? sourceFromAsset(activeSlotSelected) : null}
                    runtimeSource={activeRuntimeSource}
                    runtimeEmptyTitle={activeEmpty.title}
                    runtimeEmptyNote={activeEmpty.note}
                  />
                ) : (
                  <RuntimeMedia
                    source={activeLoupeSource}
                    emptyTitle={activeEmpty.title}
                    emptyNote={activeEmpty.note}
                    emptyIcon={activeEmpty.icon}
                    onActivate={(s) => setPreview({ source: s, label: `${activeDef.name} · ${s.label}` })}
                  />
                )}
              </div>

              {/* 10-State Contact Filmstrip */}
              <div className="filmstrip" role="navigation" aria-label="全部状态胶片条">
                {orderedDefs.base.map(renderFilmTile)}
                <span className="film-sep" aria-hidden />
                {orderedDefs.runtime.map(renderFilmTile)}
                {orderedDefs.concept.length > 0 ? (
                  <>
                    <span className="film-sep" aria-hidden />
                    {orderedDefs.concept.map(renderFilmTile)}
                  </>
                ) : null}
              </div>

              {/* State EXIF & Action Strip */}
              <div className="state-exif-bar">
                <div className="stack-sm">
                  <div className="cluster">
                    {activeIsConfigurable ? (
                      <Badge tone="accent">可配置核心锚点</Badge>
                    ) : activeDef.runtimeStateKey ? (
                      <Badge tone="good">Muse 运行时驱动</Badge>
                    ) : (
                      <Badge>工作室扩展状态</Badge>
                    )}
                    <span className="mono">
                      {activeDef.stateKey} // {capabilities?.mode ?? 'shared_base'}
                    </span>
                  </div>
                  <h2 className="panel-title">{activeDef.name}</h2>
                  <p className="prose">{activeDef.description}</p>

                  {activeIsConfigurable && activeSlot && activeSlot.assets.length > 1 ? (
                    <div className="stack-sm" style={{ marginTop: 6 }}>
                      <span className="meta">切换此槽位已选素材</span>
                      <div className="thumb-strip">
                        {activeSlot.assets.map((a) => (
                          <button
                            key={a.linkId}
                            type="button"
                            className="thumb"
                            aria-pressed={a.isSelected}
                            aria-label={`选用素材 ${a.filePath}`}
                            onClick={async () => {
                              try {
                                await api.selectAsset({ profileId, stateKey: activeDef.stateKey, assetId: a.id })
                                invalidate()
                              } catch (error) {
                                onToast(`选择失败：${error instanceof Error ? error.message : '未知错误'}`)
                              }
                            }}
                          >
                            <RuntimeMedia source={sourceFromAsset(a)} mode="still" badge={false} emptyTitle="" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="stack-sm">
                  <dl className="tech-grid">
                    <div>
                      <dt>媒体来源</dt>
                      <dd>{activeLoupeSource?.label ?? '无画面'}</dd>
                    </div>
                    <div>
                      <dt>本地槽位素材</dt>
                      <dd className="mono">
                        {activeSlot?.assets.length ?? 0} 项
                        {activeSlotSelected?.sha256 ? ` · SHA256 ${activeSlotSelected.sha256.slice(0, 10)}…` : ''}
                      </dd>
                    </div>
                  </dl>

                  {activeIsConfigurable ? (
                    <div className="action-row" style={{ marginTop: 8 }}>
                      <Button variant="primary" size="sm" onClick={() => triggerUpload(activeDef.stateKey, 'add')}>
                        <Icon name="upload" size={14} />
                        上传素材
                      </Button>
                      {!activeSlotSelected && activeDef.stateKey === 'base' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={importBase.isPending}
                          onClick={() => importBase.mutate()}
                        >
                          <Icon name="image" size={14} />
                          {importBase.isPending ? '导入中…' : '导入运行时原图'}
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setTab('generate')}>
                        <Icon name="spark" size={14} />
                        前往生成
                      </Button>
                      {activeSlotSelected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerUpload(activeDef.stateKey, 'replace')}
                        >
                          替换
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="meta" style={{ marginTop: 6 }}>
                      此状态由 Muse 运行时自动驱动或派生，只读展示。按键盘 ← / → 可快速切换状态。
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 32 }}>
              <div className="loupe-bar">
                <Segmented
                  ariaLabel="切换检视模式"
                  value={galleryMode}
                  onChange={(v) => setGalleryMode(v as GalleryMode)}
                  options={[
                    { value: 'loupe', label: '单图检视' },
                    { value: 'contact', label: '全览印样', icon: 'grid' },
                  ]}
                />
                <Badge tone="accent">{capabilities?.mode ?? 'shared_base'}</Badge>
              </div>

              {orderedDefs.base.length > 0 ? (
                <section className="sheet-group">
                  <div className="sheet-group-head">
                    <h2 className="sheet-heading">01 // 基础形象锚点</h2>
                    <span className="meta">当前模式下可同步至 Muse 的核心可配置槽位</span>
                  </div>
                  {orderedDefs.base.map(renderGalleryCard)}
                </section>
              ) : null}

              <section className="sheet-group">
                <div className="sheet-group-head">
                  <h2 className="sheet-heading">02 // 运行时动态表现</h2>
                  <span className="meta">由 Muse 运行时自动驱动，悬停可聚光检视</span>
                </div>
                <div className="gallery-grid">{orderedDefs.runtime.map(renderGalleryCard)}</div>
              </section>

              {orderedDefs.concept.length > 0 ? (
                <section className="sheet-group">
                  <div className="sheet-group-head">
                    <h2 className="sheet-heading">03 // 工作室扩展状态</h2>
                    <span className="meta">Muse 内部动画派生，当前无独立运行时槽位</span>
                  </div>
                  <div className="concept-grid">{orderedDefs.concept.map(renderGalleryCard)}</div>
                </section>
              ) : null}
            </div>
          )
        ) : null}

        {/* CHAPTER 02: PERSONA MANUSCRIPT DOSSIER */}
        {tab === 'settings' ? (
          d.settings ? (
            <SettingsForm
              profileId={profileId}
              initial={d.settings}
              settingsText={d.settingsText}
              saving={saveSettings.isPending}
              onSave={(patch) => saveSettings.mutateAsync(patch)}
            />
          ) : (
            <EmptyState title="暂无设定" body="此角色卡还没有设定记录，请先保存一次设定。" />
          )
        ) : null}

        {/* CHAPTER 03: GENERATION LAB */}
        {tab === 'generate' ? (
          <GeneratePanel
            profileId={profileId}
            stateDefs={d.stateDefs}
            candidates={d.candidates}
            generating={generate.isPending}
            onGenerate={(stateKey, stateBrief, extra) => generate.mutateAsync({ stateKey, stateBrief, extra })}
            onAdopt={(candidateId, stateKey) => adopt.mutate({ candidateId, stateKey })}
            onDiscard={async (candidateId) => {
              try {
                await api.discardCandidate({ candidateId })
                invalidate()
                onToast('已丢弃候选')
              } catch (error) {
                onToast(`丢弃失败：${error instanceof Error ? error.message : '未知错误'}`)
              }
            }}
            onPreview={(source, label) => setPreview({ source, label })}
          />
        ) : null}

        {/* CHAPTER 04: REFERENCE WALL */}
        {tab === 'references' ? (
          <ReferencesTab
            assets={d.references}
            onUpload={() => triggerUpload('base', 'add')}
            onPreview={(source, label) => setPreview({ source, label })}
            onDelete={(a: Asset) =>
              setConfirm({
                title: '删除参考素材？',
                body: `将删除「${a.filePath}」。删除是永久操作：文件、全部槽位链接与参考标记都会被移除，无法恢复。`,
                onConfirm: async () => {
                  try {
                    await api.deleteAsset({ profileId, assetId: a.id })
                    invalidate()
                    onToast('素材已删除')
                  } catch (error) {
                    onToast(`删除失败：${error instanceof Error ? error.message : '未知错误'}`)
                  }
                },
              })
            }
          />
        ) : null}
      </div>

      {/* SLIDE-OVER ARCHIVE & TECHNICAL DRAWER */}
      {drawerOpen ? (
        <>
          <button type="button" className="drawer-scrim" aria-label="关闭档案抽屉" onClick={() => setDrawerOpen(false)} />
          <aside className="atelier-drawer" aria-label="角色档案与技术信息">
            <div className="drawer-head">
              <h2 className="drawer-title">档案与技术信息</h2>
              <button type="button" className="hud-action-text" aria-label="关闭" onClick={() => setDrawerOpen(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="drawer-body">
              <div className="stack-sm">
                <p className="prose">{d.profile.description || '尚未填写人格摘要。'}</p>
                <p className="meta">
                  激活只写本地记录与设定快照（providerStatus=local_record），不隐式调用 Muse avatar.set；同步到 Muse 为显式独立流程。
                </p>
              </div>

              <div className="stack-sm">
                <span className="field-label">档案操作</span>
                <div className="action-row">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDrawerOpen(false)
                      setEditOpen(true)
                    }}
                  >
                    <Icon name="edit" size={14} />
                    编辑资料
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Icon name="copy" size={14} />
                    导出 JSON
                  </Button>
                  <Button variant="outline" size="sm" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>
                    <Icon name="layers" size={14} />
                    {duplicate.isPending ? '复制中…' : '复制角色卡'}
                  </Button>
                </div>
              </div>

              <div className="stack-sm">
                <span className="field-label">技术标识与记录</span>
                <dl className="tech-grid">
                  <div>
                    <dt>Profile ID</dt>
                    <dd className="mono">{d.profile.id}</dd>
                  </div>
                  <div>
                    <dt>Settings ID</dt>
                    <dd className="mono">{d.profile.settingsId ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>基础形象选中素材</dt>
                    <dd className="mono">{baseSlot?.selectedAssetId ?? '未选'}</dd>
                  </div>
                  <div>
                    <dt>最近激活时间</dt>
                    <dd>{d.activations[0]?.activatedAt ?? '无记录'}</dd>
                  </div>
                  <div>
                    <dt>生成任务记录（近 30）</dt>
                    <dd className="num">{d.jobs.length} 条</dd>
                  </div>
                </dl>
              </div>

              <div className="stack-sm" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <span className="field-label">危险操作</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDrawerOpen(false)
                    setConfirm({
                      title: '归档此角色卡？',
                      body: '归档后角色卡会标记为已归档并可随时恢复；已激活的角色须先解除激活。',
                      confirmLabel: '确认归档',
                      onConfirm: async () => {
                        try {
                          await api.archiveProfile({ id: profileId })
                          invalidate()
                          onToast('已归档角色卡')
                          onBack()
                        } catch (error) {
                          onToast(`归档失败：${error instanceof Error ? error.message : '未知错误'}`)
                        }
                      },
                    })
                  }}
                >
                  <Icon name="archive" size={14} />
                  归档角色卡
                </Button>
                <Button
                  variant="dangerOutline"
                  size="sm"
                  onClick={() => {
                    setDrawerOpen(false)
                    setConfirm({
                      title: '永久删除此角色卡？',
                      body: '删除将移除该角色卡的设定、画廊链接与专属素材文件，无法恢复。删除前须先解除激活。',
                      confirmLabel: '永久删除',
                      onConfirm: async () => {
                        try {
                          await api.deleteProfile({ id: profileId })
                          invalidate()
                          onToast('已删除角色卡')
                          onBack()
                        } catch (error) {
                          onToast(`删除失败：${error instanceof Error ? error.message : '未知错误'}`)
                        }
                      },
                    })
                  }}
                >
                  <Icon name="trash" size={14} />
                  删除角色卡
                </Button>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        className="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onUploadFile(f)
          e.target.value = ''
        }}
      />

      <PreviewDialog
        open={preview != null}
        onOpenChange={(o) => !o && setPreview(null)}
        source={preview?.source ?? null}
        label={preview?.label ?? ''}
      />

      {editOpen ? (
        <ProfileEditModal
          profile={d.profile}
          saving={updateProfile.isPending}
          onClose={() => setEditOpen(false)}
          onSubmit={(input) => updateProfile.mutate(input)}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirm(null)}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel ?? '确认'}
          onConfirm={confirm.onConfirm}
        />
      ) : null}
    </div>
  )
}

function ProfileEditModal({
  profile,
  saving,
  onClose,
  onSubmit,
}: {
  profile: CharacterProfile
  saving: boolean
  onClose: () => void
  onSubmit: (input: { name: string; subtitle: string; description: string; tags: string[] }) => void
}) {
  const [name, setName] = useState(profile.name)
  const [subtitle, setSubtitle] = useState(profile.subtitle ?? '')
  const [description, setDescription] = useState(profile.description ?? '')
  const [tagsText, setTagsText] = useState(profile.tags.join('、'))

  const handleSave = () => {
    const cleanName = name.trim()
    if (!cleanName) return
    const tags = tagsText
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12)
    onSubmit({ name: cleanName, subtitle: subtitle.trim(), description: description.trim(), tags })
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="编辑角色卡片资料">
      <div className="stack">
        <Field label="角色名称（允许同名，ID 为唯一身份）">
          <TextInput value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="副标题（用于区分同角色的不同人格）">
          <TextInput
            value={subtitle}
            maxLength={120}
            placeholder="例如：原作人格 / 日常人格"
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>
        <Field label="人格摘要">
          <TextArea
            rows={3}
            maxLength={2000}
            value={description}
            placeholder="一两句话概括这套形象与人格的气质"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="标签（顿号、逗号或空格分隔，最多 12 个）">
          <TextInput value={tagsText} placeholder="原作、战斗" onChange={(e) => setTagsText(e.target.value)} />
        </Field>
        <div className="action-row end">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={saving || !name.trim()} onClick={handleSave}>
            <Icon name="check" size={14} />
            {saving ? '保存中…' : '保存资料'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ReferencesTab({
  assets,
  onUpload,
  onPreview,
  onDelete,
}: {
  assets: Asset[]
  onUpload: () => void
  onPreview: (source: RuntimeMediaSource, label: string) => void
  onDelete: (a: Asset) => void
}) {
  return (
    <section className="sheet-group" aria-label="参考情绪板">
      <div className="sheet-group-head">
        <div>
          <h2 className="sheet-heading">04 // 参考墙</h2>
          <p className="meta">外观与画风参考图；支持 png / jpeg / webp / gif / mp4 / webm</p>
        </div>
        <Button variant="outline" size="sm" onClick={onUpload}>
          <Icon name="upload" size={14} />
          上传素材
        </Button>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon="image"
          title="参考墙尚为空白"
          body="上传外观或画风参考图后将集中展示于此，点击可高清检视。"
          action={
            <Button variant="primary" size="sm" onClick={onUpload}>
              <Icon name="upload" size={14} />
              上传第一张素材
            </Button>
          }
        />
      ) : (
        <div className="tile-grid">
          {assets.map((a) => {
            const source = sourceFromAsset(a, '参考素材')
            return (
              <figure key={a.id} className="gallery-card" style={{ margin: 0 }}>
                <div className="media-11">
                  <RuntimeMedia
                    source={source}
                    badge={false}
                    emptyTitle="素材无预览"
                    emptyNote="该素材没有可显示的文件。"
                    onActivate={(s) => onPreview(s, `参考素材 · ${a.format.toUpperCase()}`)}
                  />
                </div>
                <figcaption className="ref-cap">
                  <span className="mono ellipsis">
                    {a.sha256 ? `${a.sha256.slice(0, 10)}…` : a.format} · {a.source}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(a)} aria-label="删除参考素材">
                    <Icon name="trash" size={14} />
                  </Button>
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}
    </section>
  )
}
