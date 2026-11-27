import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, STUDIO_KEY } from './api'
import { AUDITED_CAPABILITIES, RUNTIME_BASE_MD5, type View } from './shared'
import { Icon } from './components/icons'
import { Badge, Button, EmptyState, LoadingNote, MediaImage, Notice, Panel, SearchInput, Segmented, StatusMark } from './components/ui'
import { ProfileCard } from './components/ProfileCard'
import { Workspace } from './Workspace'

/**
 * App — three views, no router:
 * library | workspace | system. Workspace is never remounted by a key.
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
    <div className="app-shell">
      <aside className="side">
        <button type="button" className="side-brand" onClick={() => setView({ kind: 'library' })}>
          <span className="side-logo" aria-hidden>
            <Icon name="mark" size={18} />
          </span>
          <span>
            <span className="side-mark">Muse</span>
            <span className="side-product">Character Studio</span>
          </span>
        </button>
        <nav className="side-nav" aria-label="主导航">
          <button
            type="button"
            className="side-link"
            aria-current={view.kind === 'library' ? 'page' : undefined}
            onClick={() => setView({ kind: 'library' })}
          >
            <Icon name="library" />
            角色库
          </button>
          <button
            type="button"
            className="side-link"
            aria-current={view.kind === 'system' ? 'page' : undefined}
            onClick={() => setView({ kind: 'system' })}
          >
            <Icon name="settings" />
            系统设置
          </button>
        </nav>
      </aside>

      <div className="app-frame">
      <main className="app-main">
        {toast ? <Notice floating>{toast}</Notice> : null}

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
  if (props.loading) {
    return (
      <div className="pane" aria-busy="true" aria-label="加载角色库">
        <div className="pane-scroll">
          <div className="wall">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (props.error) return <div className="pane"><div className="pane-scroll"><EmptyState title="角色库加载失败" body="请刷新页面重试；数据在服务端，本地草稿不会丢失。" /></div></div>
  return (
    <div className="pane">
      <header className="pane-head">
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">角色库</h1>
          <p className="page-lead">一张卡就是一个完整的 Muse 形象与人格配置。名称可重复，ID 才是身份。</p>
        </div>
        <Button variant="primary" onClick={props.onCreate}>
          <Icon name="plus" />
          新建角色卡
        </Button>
      </div>
      <div className="toolbar">
        <SearchInput
          placeholder="搜索名称或副标题…"
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value)}
          aria-label="搜索名称或副标题"
        />
        <Segmented
          ariaLabel="角色库筛选"
          value={props.onlyFavorites ? 'fav' : 'all'}
          onChange={(v) => props.setOnlyFavorites(v === 'fav')}
          options={[
            { value: 'all', label: '全部', icon: 'library' },
            { value: 'fav', label: '只看收藏', icon: 'star' },
          ]}
        />
      </div>
      </header>
      <div className="pane-scroll">
      {props.profiles.length === 0 ? (
        <EmptyState title="还没有角色卡" body="新建一张黑岩射手卡，或等首开自动种入原作人格与日常人格两张卡。" />
      ) : (
        <div className="wall">
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
      </div>
    </div>
  )
}

function SystemView({ onBack }: { onBack: () => void }) {
  const caps = AUDITED_CAPABILITIES
  return (
    <div className="pane view-enter">
      <header className="pane-head">
      <div className="cluster">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="arrowLeft" />
          返回角色库
        </Button>
        <h1 className="page-title">系统设置</h1>
      </div>
      </header>
      <div className="pane-scroll">
      <div className="system-grid">
        <Panel title="Muse 当前运行时形象">
          <div className="runtime-row">
            <MediaImage
              className="runtime-shot"
              src="/assets/runtime/base.webp"
              alt="当前运行时头像"
              fallback={<div className="runtime-shot" role="img" aria-label="本地没有运行时原图" />}
            />
            <div className="stack-sm">
              <p className="prose">黑岩射手 · 原作人格（已恢复的 v1 原图）</p>
              <p className="meta">
                MD5 <span className="mono">{RUNTIME_BASE_MD5}</span> · 1600×1600 · 164690 字节
              </p>
              <div className="cluster">
                <Badge tone="accent">shared_base</Badge>
                <Badge>原图恢复 · 换文件法已验证</Badge>
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Muse 能力矩阵（已审计，不虚构）">
          <div className="stack">
            <div className="mark-grid">
              <StatusMark tone="good" label={`模式：${caps.mode}（单一基础形象）`} />
              <StatusMark tone="good" label="静态图片：支持" />
              <StatusMark tone="good" label="视频变体：支持" />
              <StatusMark tone="bad" label="独立状态素材：不支持" />
              <StatusMark tone="bad" label="候选 ID 可复用：否（一次即失效）" />
              <StatusMark tone="good" label="候选激活：支持" />
            </div>
            <p className="meta">
              完成度只按可配置槽位计算（基础形象 1/1）。idle / waking / working / making_something / milestone_level_up
              为 Muse 运行时自动驱动，只读展示；listening / thinking / speaking / error 不是 Muse 独立槽位，不得伪装。
            </p>
          </div>
        </Panel>
        <Panel className="system-span" title="存储与完整性">
          <p className="prose">
            SQLite 为唯一权威元数据，JSON 为可导出副本；素材按 UUID 目录存放，保存时算 SHA-256、生成缩略图、原子 rename；
            清除 Muse 头像不会清理本地资产库。
          </p>
        </Panel>
      </div>
      </div>
    </div>
  )
}
