import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, profileKey } from './api'
import type { Asset } from './shared'
import { Button, EmptyState } from './components/ui'
import { ConfirmDialog } from './components/ConfirmDialog'
import { GalleryCard } from './components/GalleryCard'
import { GeneratePanel } from './components/GeneratePanel'
import { Hero } from './components/Hero'
import { PreviewDialog } from './components/PreviewDialog'
import { SettingsForm } from './components/SettingsForm'

type Tab = 'gallery' | 'settings' | 'generate' | 'references'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'gallery', label: '状态画廊' },
  { key: 'settings', label: '角色设定' },
  { key: 'generate', label: '生成中心' },
  { key: 'references', label: '参考素材' },
]

/**
 * Workspace — deliberately NOT keyed by profile id in App, and tabs do
 * not unmount each other: the active tab is rendered conditionally but
 * SettingsForm / GeneratePanel drafts live in localStorage (useDraft),
 * so switching tabs, switching profiles, or reloading never loses edits.
 * Technical IDs are hidden behind a <details> element.
 */
export function Workspace({
  profileId,
  onBack,
  onToast,
  onOpenSystem,
}: {
  profileId: string
  onBack: () => void
  onToast: (msg: string) => void
  onOpenSystem: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('gallery')
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; confirmLabel?: string; onConfirm: () => void } | null>(null)
  const [showTech, setShowTech] = useState(false)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
  })
  const adopt = useMutation({
    mutationFn: (v: { candidateId: string; stateKey: string }) => api.adoptCandidate({ profileId, ...v }),
    onSuccess: () => {
      invalidate()
      onToast('候选已加入画廊')
    },
  })

  // Keep the tab in view on profile change without remounting the page.
  useEffect(() => {
    setTab('gallery')
    setActivationNote(null)
  }, [profileId])

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

  if (detail.isLoading) return <p className="py-16 text-center text-sm text-[var(--color-ink-3)]">加载角色工作台…</p>
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>← 角色库</Button>
        <button type="button" onClick={onOpenSystem} className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
          系统设置 →
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
      {activationNote ? (
        <p role="status" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-good-soft)] px-4 py-2.5 text-sm text-[var(--color-good)]">
          {activationNote}
        </p>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]" aria-label="工作台导航">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium ${tab === t.key ? 'tab-active' : 'tab-idle'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'gallery' ? (
        <section aria-label="状态画廊">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl text-[var(--color-ink)]">状态画廊</h2>
            <span className="badge-accent">shared_base · 仅基础形象可同步</span>
          </div>
          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-[var(--color-ink-3)]">
            基础形象展示当前选定素材；其余状态展示 Muse 实际运行时表现，自动驱动、无需手动配图。
            未配置的本地素材不会伪装成 Muse 当前形象；需要对比时才显示双图对照。
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {d.stateDefs.map((def) => (
              <GalleryCard
                key={def.stateKey}
                def={def}
                slot={d.slots.find((s) => s.stateKey === def.stateKey)}
                runtimeFrameUrl={def.runtimeStateKey ? runtimeFrames[def.runtimeStateKey] : null}
                onPreview={(url, label) => setPreview({ url, label })}
                onSelectAsset={async (assetId) => {
                  await api.selectAsset({ profileId, stateKey: def.stateKey, assetId })
                  invalidate()
                }}
                onUpload={() => fileRef.current?.click()}
                onGenerate={() => setTab('generate')}
                onCompare={() => undefined}
              />
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUploadFile(f)
              e.target.value = ''
            }}
          />
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
                await api.deleteAsset({ profileId, assetId: a.id })
                invalidate()
                onToast('素材已删除')
              },
            })
          }
        />
      ) : null}

      <details className="card p-4" open={showTech} onToggle={(e) => setShowTech((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-ink-2)]">
          技术信息（默认隐藏）· 内部运行信息
        </summary>
        <dl className="mt-3 grid gap-2 text-xs text-[var(--color-ink-3)] sm:grid-cols-2">
          <div><dt className="font-medium text-[var(--color-ink-2)]">Profile ID</dt><dd className="font-mono break-all">{d.profile.id}</dd></div>
          <div><dt className="font-medium text-[var(--color-ink-2)]">Settings ID</dt><dd className="font-mono break-all">{d.profile.settingsId ?? '—'}</dd></div>
          <div><dt className="font-medium text-[var(--color-ink-2)]">Gallery ID</dt><dd className="font-mono break-all">{d.profile.galleryId ?? '—'}</dd></div>
          <div><dt className="font-medium text-[var(--color-ink-2)]">基础形象选中素材</dt><dd className="font-mono break-all">{baseSlot?.selectedAssetId ?? '未选'}</dd></div>
          <div><dt className="font-medium text-[var(--color-ink-2)]">最近激活</dt><dd>{d.activations[0]?.activatedAt ?? '无记录'}</dd></div>
          <div><dt className="font-medium text-[var(--color-ink-2)]">生成任务（近 30）</dt><dd>{d.jobs.length} 条</dd></div>
        </dl>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setConfirm({
              title: '归档此角色卡？',
              body: '归档后角色卡会从角色库主列表移入归档，可恢复；已激活的角色须先解除激活。',
              confirmLabel: '确认归档',
              onConfirm: async () => {
                await api.archiveProfile({ id: profileId })
                invalidate()
                onToast('已归档')
                onBack()
              },
            })
          }
        >
          归档角色卡
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            setConfirm({
              title: '删除此角色卡？',
              body: '删除是危险操作。删除前须先解除激活，且被激活配置引用的素材不可删除。',
              onConfirm: async () => {
                await api.deleteProfile({ id: profileId })
                invalidate()
                onToast('已删除')
                onBack()
              },
            })
          }
        >
          删除角色卡
        </Button>
      </div>

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
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-[var(--color-ink)]">参考素材</h2>
        <Button variant="outline" onClick={onUpload}>上传素材</Button>
      </div>
      {assets.length === 0 ? (
        <EmptyState title="暂无参考素材" body="上传外观或画风参考图，生成时会作为参考注入；仅支持 png / jpeg / webp / gif / mp4 / webm。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <figure key={a.id} className="card overflow-hidden">
              {a.url ? <img src={a.url} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : null}
              <figcaption className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-xs text-[var(--color-ink-3)]">
                  {a.sha256 ? `SHA-256 ${a.sha256.slice(0, 12)}…` : a.format} · {a.source}
                </span>
                <button type="button" onClick={() => onDelete(a)} className="shrink-0 text-xs text-[var(--color-bad)] hover:underline">
                  删除
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}
