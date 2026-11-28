import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { api, profileKey } from './api'
import type { Asset } from './shared'
import { Icon } from './components/icons'
import { Badge, Button, EmptyState, LoadingNote, Notice, TabBar } from './components/ui'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ConfirmDialog } from './components/ConfirmDialog'
import { GalleryCard } from './components/GalleryCard'
import { GeneratePanel } from './components/GeneratePanel'
import { Hero } from './components/Hero'
import { PreviewDialog } from './components/PreviewDialog'
import { SettingsForm } from './components/SettingsForm'

type Tab = 'gallery' | 'settings' | 'generate' | 'references'

const TABS: Array<{ value: Tab; label: string; icon: 'layers' | 'sliders' | 'spark' | 'image' }> = [
  { value: 'gallery', label: '状态画廊', icon: 'layers' },
  { value: 'settings', label: '角色设定', icon: 'sliders' },
  { value: 'generate', label: '生成中心', icon: 'spark' },
  { value: 'references', label: '参考素材', icon: 'image' },
]

/**
 * Workspace is not keyed by profile id. Tab bodies stay mounted only while
 * selected; drafts live in localStorage, so switching tabs does not lose edits.
 * Technical IDs stay behind a details element.
 */
export function Workspace({
  profileId,
  onBack,
  onToast,
}: {
  profileId: string
  onBack: () => void
  onToast: (msg: string) => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('gallery')
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; confirmLabel?: string; onConfirm: () => void } | null>(null)
  const [showTech, setShowTech] = useState(false)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const narrow = useMediaQuery('(max-width: 1080px)')
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    if (window.matchMedia('(max-width: 1080px)').matches) return false
    try {
      return localStorage.getItem('mcs-ui-inspector-open') !== '0'
    } catch {
      return true
    }
  })
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    try {
      const width = Number(localStorage.getItem('mcs-ui-inspector'))
      return Number.isFinite(width) && width >= 280 && width <= 440 ? width : 320
    } catch {
      return 320
    }
  })

  const detail = useQuery({ queryKey: profileKey(profileId), queryFn: () => api.getProfileDetail({ id: profileId }) })
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
  const activate = useMutation({
    mutationFn: () => api.activateProfile({ profileId }),
    onSuccess: (res) => {
      invalidate()
      setActivationNote(`已激活（本地记录 ${res.activation.id.slice(0, 8)}…）。运行时头像同步仍走候选流程，本次未改运行时头像。`)
      onToast('角色已激活')
    },
    onError: (e) => onToast(`激活失败：${e instanceof Error ? e.message : '未知错误'}`),
  })
  const generate = useMutation({
    mutationFn: (v: { stateKey: string; stateBrief: string; extra: string }) =>
      api.generateAsset({ profileId, ...v }),
    onSuccess: () => {
      invalidate()
      onToast('已生成候选，请在生成中心采纳')
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
    setActivationNote(null)
  }, [profileId])

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [tab, profileId])

  const wasNarrow = useRef(narrow)
  useEffect(() => {
    if (narrow && !wasNarrow.current) setInspectorOpen(false)
    if (!narrow && wasNarrow.current) {
      try {
        setInspectorOpen(localStorage.getItem('mcs-ui-inspector-open') !== '0')
      } catch {
        setInspectorOpen(true)
      }
    }
    wasNarrow.current = narrow
  }, [narrow])

  useEffect(() => {
    if (narrow) return
    try {
      localStorage.setItem('mcs-ui-inspector-open', inspectorOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [inspectorOpen, narrow])

  useEffect(() => {
    if (!narrow || !inspectorOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectorOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [narrow, inspectorOpen])

  const d = detail.data
  const baseSlot = useMemo(() => d?.slots.find((s) => s.stateKey === 'base'), [d])
  const coverUrl = d?.profile.coverUrl ?? '/assets/runtime/base.webp'
  const runtimeFrames: Record<string, string> = {
    idle: '/assets/runtime/base.webp',
    waking: '/assets/runtime/base.webp',
    working: '/assets/runtime/base.webp',
    making_something: '/assets/runtime/base.webp',
    milestone_level_up: '/assets/runtime/base.webp',
  }

  if (detail.isLoading) return <LoadingNote>加载角色工作台…</LoadingNote>
  if (detail.isError || !d) {
    return (
      <EmptyState
        title="角色加载失败"
        body="请返回角色库重试。"
        action={<Button variant="outline" onClick={onBack}>返回角色库</Button>}
      />
    )
  }

  const onUploadFile = async (file: File) => {
    try {
      await api.uploadAsset({ profileId, stateKey: 'base', file })
      invalidate()
      onToast('素材已上传')
    } catch (e) {
      onToast(`上传失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }

  const onSplitterDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startW = inspectorWidth
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const move = (ev: PointerEvent) => {
      setInspectorWidth(Math.min(440, Math.max(280, startW - (ev.clientX - startX))))
    }
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', move)
      const next = Math.min(440, Math.max(280, startW - (ev.clientX - startX)))
      setInspectorWidth(next)
      try {
        localStorage.setItem('mcs-ui-inspector', String(next))
      } catch {
        /* ignore */
      }
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up, { once: true })
  }

  return (
    <div
      className="workspace"
      data-inspector={inspectorOpen ? 'open' : 'closed'}
      style={{ '--inspector-w': `${inspectorWidth}px` } as CSSProperties}
    >
      <div className="subnav">
        <TabBar
          className="tabs-vertical"
          ariaLabel="工作台导航"
          value={tab}
          onChange={(next) => setTab(next as Tab)}
          options={TABS}
        />
        <Button variant="outline" size="sm" className="inspector-show" onClick={() => setInspectorOpen(true)}>
          角色信息
        </Button>
      </div>

      <div className="workspace-main" ref={mainRef}>
        <header className="workspace-title">
          <h1 className="page-title">{d.profile.name}</h1>
          {d.profile.subtitle ? <p className="page-lead">{d.profile.subtitle}</p> : null}
        </header>
        {tab === 'gallery' ? (
          <section className="stack" aria-label="状态画廊">
            <div className="cluster">
              <h2 className="section-title">状态画廊</h2>
              <Badge tone="accent">shared_base · 仅基础形象可同步</Badge>
            </div>
            <p className="prose">
              基础形象展示当前选定素材；其余状态展示 Muse 实际运行时表现，自动驱动、无需手动配图。
              未配置的本地素材不会伪装成 Muse 当前形象；需要对比时才显示双图对照。
            </p>
            <div className="gallery-grid">
              {d.stateDefs.map((def) => (
                <GalleryCard
                  key={def.stateKey}
                  def={def}
                  slot={d.slots.find((s) => s.stateKey === def.stateKey)}
                  runtimeFrameUrl={def.runtimeStateKey ? runtimeFrames[def.runtimeStateKey] : null}
                  onPreview={(url, label) => setPreview({ url, label })}
                  onSelectAsset={async (assetId) => {
                    try {
                      await api.selectAsset({ profileId, stateKey: def.stateKey, assetId })
                      invalidate()
                    } catch (error) {
                      onToast(`选择失败：${error instanceof Error ? error.message : '未知错误'}`)
                    }
                  }}
                  onUpload={() => fileRef.current?.click()}
                  onGenerate={() => setTab('generate')}
                  onCompare={() => undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'settings' ? (
          d.settings ? (
            <SettingsForm
              profileId={profileId}
              initial={d.settings}
              settingsText={d.settingsText}
              saving={saveSettings.isPending}
              onSave={(patch) => saveSettings.mutate(patch)}
            />
          ) : (
            <EmptyState title="暂无设定" body="此角色卡还没有设定记录，请先保存一次设定。" />
          )
        ) : null}

        {tab === 'generate' ? (
          <GeneratePanel
            profileId={profileId}
            stateDefs={d.stateDefs}
            candidates={d.candidates}
            generating={generate.isPending}
            onGenerate={(stateKey, stateBrief, extra) => generate.mutate({ stateKey, stateBrief, extra })}
            onAdopt={(candidateId, stateKey) => adopt.mutate({ candidateId, stateKey })}
            onDiscard={async (candidateId) => {
              await api.discardCandidate({ candidateId })
              invalidate()
            }}
          />
        ) : null}

        {tab === 'references' ? (
          <ReferencesTab
            assets={d.references}
            onUpload={() => fileRef.current?.click()}
            onDelete={(a: Asset) =>
              setConfirm({
                title: '删除参考素材？',
                body: `将删除「${a.filePath}」。已激活配置引用的素材不可删除，删除后可在回收站恢复（30 天）。`,
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

      <div
        className="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整角色信息宽度"
        aria-valuemin={280}
        aria-valuemax={440}
        aria-valuenow={inspectorWidth}
        tabIndex={0}
        onPointerDown={onSplitterDown}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const delta = event.key === 'ArrowLeft' ? 16 : -16
          const next = Math.min(440, Math.max(280, inspectorWidth + delta))
          setInspectorWidth(next)
          try {
            localStorage.setItem('mcs-ui-inspector', String(next))
          } catch {
            /* ignore */
          }
        }}
      />
      {narrow && inspectorOpen ? (
        <button type="button" className="sheet-scrim" aria-label="关闭角色信息" onClick={() => setInspectorOpen(false)} />
      ) : null}
      <aside className="inspector-pane" aria-label="角色信息" aria-hidden={narrow && !inspectorOpen}>
        <div className="inspector-bar">
          <span className="meta">角色信息</span>
          <button type="button" className="icon-btn" aria-label="隐藏角色信息" onClick={() => setInspectorOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <Hero
          profile={d.profile}
          isActive={d.isActive}
          coverUrl={coverUrl}
          activating={activate.isPending}
          onActivate={() => activate.mutate()}
          onEditProfile={() => setTab('settings')}
        />
        {activationNote ? <Notice tone="good">{activationNote}</Notice> : null}
        <details className="panel tech" open={showTech} onToggle={(e) => setShowTech((e.target as HTMLDetailsElement).open)}>
          <summary>技术信息</summary>
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
              <dt>Gallery ID</dt>
              <dd className="mono">{d.profile.galleryId ?? '—'}</dd>
            </div>
            <div>
              <dt>基础形象选中素材</dt>
              <dd className="mono">{baseSlot?.selectedAssetId ?? '未选'}</dd>
            </div>
            <div>
              <dt>最近激活</dt>
              <dd>{d.activations[0]?.activatedAt ?? '无记录'}</dd>
            </div>
            <div>
              <dt>生成任务（近 30）</dt>
              <dd>{d.jobs.length} 条</dd>
            </div>
          </dl>
        </details>
        <section className="panel">
          <div className="panel-body danger-zone">
            <p className="meta">危险操作</p>
            <Button
              variant="outline"
              onClick={() =>
                setConfirm({
                  title: '归档此角色卡？',
                  body: '归档后角色卡会从角色库主列表移入归档，可恢复；已激活的角色须先解除激活。',
                  confirmLabel: '确认归档',
                  onConfirm: async () => {
                    try {
                      await api.archiveProfile({ id: profileId })
                      invalidate()
                      onToast('已归档')
                      onBack()
                    } catch (error) {
                      onToast(`归档失败：${error instanceof Error ? error.message : '未知错误'}`)
                    }
                  },
                })
              }
            >
              <Icon name="archive" />
              归档角色卡
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                setConfirm({
                  title: '删除此角色卡？',
                  body: '删除是危险操作。删除前须先解除激活，且被激活配置引用的素材不可删除。',
                  onConfirm: async () => {
                    try {
                      await api.deleteProfile({ id: profileId })
                      invalidate()
                      onToast('已删除')
                      onBack()
                    } catch (error) {
                      onToast(`删除失败：${error instanceof Error ? error.message : '未知错误'}`)
                    }
                  },
                })
              }
            >
              <Icon name="trash" />
              删除角色卡
            </Button>
          </div>
        </section>
      </aside>

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

      <PreviewDialog open={preview != null} onOpenChange={(o) => !o && setPreview(null)} url={preview?.url ?? null} label={preview?.label ?? ''} />
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

function ReferencesTab({
  assets,
  onUpload,
  onDelete,
}: {
  assets: Asset[]
  onUpload: () => void
  onDelete: (a: Asset) => void
}) {
  return (
    <section className="stack">
      <div className="split">
        <h2 className="section-title">参考素材</h2>
        <Button variant="outline" size="sm" onClick={onUpload}>上传素材</Button>
      </div>
      {assets.length === 0 ? (
        <EmptyState title="暂无参考素材" body="上传外观或画风参考图，生成时会作为参考注入；仅支持 png / jpeg / webp / gif / mp4 / webm。" />
      ) : (
        <div className="tile-grid">
          {assets.map((a) => (
            <figure key={a.id} className="panel gallery-card">
              {a.url ? (
                <div className="media-11">
                  <img className="media-img" src={a.url} alt="" loading="lazy" />
                </div>
              ) : null}
              <figcaption className="ref-cap">
                <span className="meta ellipsis">{a.sha256 ? `SHA-256 ${a.sha256.slice(0, 12)}…` : a.format} · {a.source}</span>
                <Button variant="danger" size="sm" onClick={() => onDelete(a)}>删除</Button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}
