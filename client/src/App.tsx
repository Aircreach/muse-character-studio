import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, STUDIO_KEY } from './api'
import { AUDITED_CAPABILITIES, RUNTIME_BASE_MD5, type View } from './shared'
import { Badge, Button, EmptyState, StatusMark } from './components/ui'
import { ProfileCard } from './components/ProfileCard'
import { Workspace } from './Workspace'

/**
 * App — three views, no router library needed for this surface:
 * library | workspace | system. View state lives here so Workspace
 * is never remounted by a key change (the old key={view.id} reset).
 */
export default function App() {
  const qc = useQueryClient()
  const [view, setView] = useState<View>({ kind: 'library' })
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const studio = useQuery({ queryKey: STUDIO_KEY, queryFn: () => api.getStudio({}) })
  const seed = useMutation({
    mutationFn: () => api.seedStudio({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: STUDIO_KEY }),
  })

  useEffect(() => {
    if (toast) {
      const t = window.setTimeout(() => setToast(null), 3200)
      return () => window.clearTimeout(t)
    }
  }, [toast])

  useEffect(() => {
    if (studio.data && studio.data.profiles.length === 0) seed.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.data?.profiles.length])

  const profiles = (studio.data?.profiles ?? []).filter((p) => {
    if (onlyFavorites && !p.favorite) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.subtitle ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setView({ kind: 'library' })} className="flex items-baseline gap-2">
            <span className="font-display text-xl text-[var(--color-ink)]">Muse Character Studio</span>
            <span className="hidden text-xs text-[var(--color-ink-3)] sm:inline">角色工作室</span>
          </button>
          <nav className="ml-auto flex gap-1" aria-label="主导航">
            {(
              [
                ['library', '角色库'],
                ['system', '系统设置'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setView(kind === 'library' ? { kind: 'library' } : { kind: 'system' })}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${
                  view.kind === kind ? 'bg-[var(--color-surface-3)] font-medium text-[var(--color-ink)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {toast ? (
          <div role="status" className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm shadow-[var(--shadow-sm)]">
            {toast}
          </div>
        ) : null}

        {view.kind === 'workspace' ? (
          <Workspace
            profileId={view.id}
            onBack={() => setView({ kind: 'library' })}
            onToast={setToast}
            onOpenSystem={() => setView({ kind: 'system' })}
          />
        ) : view.kind === 'system' ? (
          <SystemView onBack={() => setView({ kind: 'library' })} />
        ) : (
          <LibraryView
            profiles={profiles}
            activeProfileId={studio.data?.activeProfileId ?? null}
            loading={studio.isLoading}
            error={studio.isError}
            query={query}
            setQuery={setQuery}
            onlyFavorites={onlyFavorites}
            setOnlyFavorites={setOnlyFavorites}
            onOpen={(id) => setView({ kind: 'workspace', id })}
            onToggleFavorite={async (id) => {
              await api.toggleFavorite({ id })
              qc.invalidateQueries({ queryKey: STUDIO_KEY })
            }}
            onCreate={async () => {
              const created = await api.createProfile({ name: '黑岩射手', subtitle: '新角色', description: '' })
              setToast('已创建新角色卡')
              setView({ kind: 'workspace', id: created.profile.id })
            }}
          />
        )}
      </main>
    </div>
  )
}

function LibraryView(props: {
  profiles: import('./shared').CharacterProfile[]
  activeProfileId: string | null
  loading: boolean
  error: boolean
  query: string
  setQuery: (v: string) => void
  onlyFavorites: boolean
  setOnlyFavorites: (v: boolean) => void
  onOpen: (id: string) => void
  onToggleFavorite: (id: string) => void
  onCreate: () => void
}) {
  if (props.loading) return <p className="py-16 text-center text-sm text-[var(--color-ink-3)]">加载角色库…</p>
  if (props.error) return <EmptyState title="角色库加载失败" body="请刷新页面重试；数据在服务端，本地草稿不会丢失。" />
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] leading-tight text-[var(--color-ink)]">角色库</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-3)]">一张卡就是一个完整的 Muse 形象与人格配置。名称可重复，ID 才是身份。</p>
        </div>
        <Button variant="primary" onClick={props.onCreate}>
          + 新建角色卡
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <input
          className="field-input max-w-sm"
          placeholder="搜索名称或副标题…"
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => props.setOnlyFavorites(!props.onlyFavorites)}
          className={`btn ${props.onlyFavorites ? 'btn-accent' : 'btn-outline'}`}
        >
          {props.onlyFavorites ? '★ 只看收藏' : '☆ 只看收藏'}
        </button>
      </div>
      {props.profiles.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="还没有角色卡" body="新建一张黑岩射手卡，或等首开自动种入原作人格与日常人格两张卡。" />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {props.profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              isActive={p.id === props.activeProfileId}
              onOpen={() => props.onOpen(p.id)}
              onToggleFavorite={() => props.onToggleFavorite(p.id)}
            />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-[var(--color-ink-4)]">
        封面为空时使用内置运行时原图（MD5 {RUNTIME_BASE_MD5.slice(0, 8)}…），不显示单字占位。
      </p>
    </div>
  )
}

function SystemView({ onBack }: { onBack: () => void }) {
  const caps = AUDITED_CAPABILITIES
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>← 返回角色库</Button>
        <h1 className="font-display text-2xl text-[var(--color-ink)]">系统设置</h1>
      </div>
      <section className="card p-5">
        <h2 className="font-display text-lg text-[var(--color-ink)]">Muse 能力矩阵（已审计，不虚构）</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <StatusMark tone="good" label={`模式：${caps.mode}（单一基础形象）`} />
          <StatusMark tone="good" label="静态图片：支持" />
          <StatusMark tone="good" label="视频变体：支持" />
          <StatusMark tone="bad" label="独立状态素材：不支持" />
          <StatusMark tone="bad" label="候选 ID 可复用：否（一次即失效）" />
          <StatusMark tone="good" label="候选激活：支持" />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          完成度只按可配置槽位计算（基础形象 1/1）。idle / waking / working / making_something / milestone_level_up
          为 Muse 运行时自动驱动，只读展示；listening / thinking / speaking / error 不是 Muse 独立槽位，不得伪装。
        </p>
      </section>
      <section className="card p-5">
        <h2 className="font-display text-lg text-[var(--color-ink)]">Muse 当前运行时形象</h2>
        <div className="mt-3 flex items-start gap-4">
          <img src="/assets/runtime/base.webp" alt="当前运行时头像" className="size-24 rounded-[var(--radius-lg)] object-cover" />
          <div>
            <p className="text-sm text-[var(--color-ink-2)]">黑岩射手 · 原作人格（已恢复的 v1 原图）</p>
            <p className="mt-1 font-mono text-xs text-[var(--color-ink-3)]">MD5 {RUNTIME_BASE_MD5} · 1600×1600 · 164690 字节</p>
            <div className="mt-2 flex gap-1.5">
              <Badge tone="accent">shared_base</Badge>
              <Badge>原图恢复 · 换文件法已验证</Badge>
            </div>
          </div>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-display text-lg text-[var(--color-ink)]">存储与完整性</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-3)]">
          SQLite 为唯一权威元数据，JSON 为可导出副本；素材按 UUID 目录存放，保存时算 SHA-256、生成缩略图、原子 rename；
          清除 Muse 头像不会清理本地资产库。
        </p>
      </section>
    </div>
  )
}
