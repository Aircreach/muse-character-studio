import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api, STUDIO_KEY } from './api'
import { AUDITED_CAPABILITIES, RUNTIME_BASE_MD5, type View } from './shared'
import { Icon } from './components/icons'
import { Shell, type NoticeItem } from './components/Shell'
import { Button, EmptyState, MediaImage, SearchInput, Segmented } from './components/ui'
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
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const noticeId = useRef(0)

  const studio = useQuery({ queryKey: STUDIO_KEY, queryFn: () => api.getStudio({}) })
  const seed = useMutation({
    mutationFn: () => api.seedStudio({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: STUDIO_KEY }),
  })

  const push = (text: string) => {
    noticeId.current += 1
    setNotices((list) => [{ id: noticeId.current, text }, ...list].slice(0, 8))
    setToast(text)
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (studio.data && studio.data.profiles.length === 0) seed.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.data?.profiles.length])

  const profiles = (studio.data?.profiles ?? []).filter((profile) => {
    if (onlyFavorites && !profile.favorite) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return profile.name.toLowerCase().includes(q) || (profile.subtitle ?? '').toLowerCase().includes(q)
  })

  const connection = studio.isError ? 'error' : studio.data ? 'ready' : 'loading'

  return (
    <Shell
      view={view}
      profiles={studio.data?.profiles ?? []}
      activeProfileId={studio.data?.activeProfileId ?? null}
      connection={connection}
      toast={toast}
      notices={notices}
      onNavigate={setView}
    >
      {view.kind === 'workspace' ? (
        <Workspace profileId={view.id} onBack={() => setView({ kind: 'library' })} onToast={push} />
      ) : view.kind === 'system' ? (
        <SystemView studioCapabilities={studio.data?.capabilities ?? null} />
      ) : (
        <LibraryView
          profiles={profiles}
          activeProfileId={studio.data?.activeProfileId ?? null}
          loading={studio.isLoading}
          error={studio.isError}
          filtered={query.trim().length > 0 || onlyFavorites}
          query={query}
          onlyFavorites={onlyFavorites}
          setQuery={setQuery}
          setOnlyFavorites={setOnlyFavorites}
          onOpen={(id) => setView({ kind: 'workspace', id })}
          onToggleFavorite={async (id) => {
            try {
              await api.toggleFavorite({ id })
              qc.invalidateQueries({ queryKey: STUDIO_KEY })
            } catch (error) {
              push(`收藏失败：${error instanceof Error ? error.message : '未知错误'}`)
            }
          }}
          onRestore={async (id) => {
            try {
              await api.restoreProfile({ id })
              qc.invalidateQueries({ queryKey: STUDIO_KEY })
              push('已恢复角色卡')
            } catch (error) {
              push(`恢复失败：${error instanceof Error ? error.message : '未知错误'}`)
            }
          }}
          onCreate={async () => {
            try {
              const created = await api.createProfile({ name: '黑岩射手', subtitle: '新角色', description: '' })
              push('已创建新角色卡')
              setView({ kind: 'workspace', id: created.profile.id })
            } catch (error) {
              push(`创建失败：${error instanceof Error ? error.message : '未知错误'}`)
            }
          }}
        />
      )}
    </Shell>
  )
}

function LibraryView(props: {
  profiles: import('./shared').CharacterProfile[]
  activeProfileId: string | null
  loading: boolean
  error: boolean
  filtered: boolean
  query: string
  onlyFavorites: boolean
  setQuery: (value: string) => void
  setOnlyFavorites: (value: boolean) => void
  onOpen: (id: string) => void
  onToggleFavorite: (id: string) => void
  onRestore: (id: string) => void
  onCreate: () => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  if (props.loading) {
    return (
      <div className="pane" aria-busy="true" aria-label="加载角色库">
        <div className="pane-scroll">
          <div className="wall">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (props.error) {
    return (
      <div className="pane">
        <div className="pane-scroll">
          <EmptyState title="角色库加载失败" body="请刷新页面重试。数据在服务端，本地草稿不会丢失。" />
        </div>
      </div>
    )
  }
  return (
    <div className="pane">
      <header className="pane-head">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">角色库</h1>
            <p className="page-lead">一张卡是一套形象和人格。名称可以重复，身份是 ID。</p>
          </div>
          <Button
            variant="primary"
            disabled={creating}
            aria-busy={creating}
            onClick={() => {
              setCreating(true)
              void props.onCreate().finally(() => setCreating(false))
            }}
          >
            <Icon name="plus" />
            {creating ? '创建中…' : '新建角色卡'}
          </Button>
        </div>
        <div className="toolbar">
          <SearchInput
            placeholder="筛选名称或副标题"
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            aria-label="筛选名称或副标题"
          />
          <Segmented
            ariaLabel="角色库筛选"
            value={props.onlyFavorites ? 'fav' : 'all'}
            onChange={(value) => props.setOnlyFavorites(value === 'fav')}
            options={[
              { value: 'all', label: '全部' },
              { value: 'fav', label: '收藏', icon: 'star' },
            ]}
          />
        </div>
      </header>
      <div className="pane-scroll">
        {props.profiles.length === 0 ? (
          <EmptyState
            title={props.filtered ? '没有匹配的角色卡' : '还没有角色卡'}
            body={props.filtered ? '换一个名称，或关掉收藏筛选。' : '新建一张黑岩射手卡。空库时也会自动种入原作人格与日常人格。'}
          />
        ) : (
          <div className="wall">
            {props.profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isActive={profile.id === props.activeProfileId}
                onOpen={() => props.onOpen(profile.id)}
                onToggleFavorite={() => props.onToggleFavorite(profile.id)}
                onRestore={profile.archivedAt ? () => props.onRestore(profile.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SystemView({ studioCapabilities }: { studioCapabilities?: import('./shared').Capabilities | null }) {
  /**
   * 能力矩阵优先取服务端 getCapabilities 的实时值；取不到时回退到
   * getStudio 带回的能力矩阵，再取不到才用前端写死的审计值，并标注来源。
   * 旧版直接用写死值，改一处时另一处不会跟着变（见附录 A.10）。
   */
  const capsQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.getCapabilities({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const liveCaps = capsQuery.data?.capabilities ?? null
  const caps = liveCaps ?? studioCapabilities ?? AUDITED_CAPABILITIES
  const capsSource = liveCaps
    ? '实时能力取自服务端 getCapabilities。'
    : studioCapabilities
      ? 'getCapabilities 未取到，显示 getStudio 返回的能力矩阵。'
      : '未取到实时能力，显示上次审计值。'
  const rows: Array<[string, string]> = [
    ['模式', `${caps.mode}（单一基础形象）`],
    ['静态图片', caps.staticImage ? '支持' : '不支持'],
    ['视频变体', caps.videoVariants ? '支持' : '不支持'],
    ['独立状态素材', caps.independentStateAssets ? '支持' : '不支持'],
    ['候选 ID 可复用', caps.candidateIdReusable ? '是' : '否，一次即失效'],
    ['候选激活', caps.candidateActivation ? '支持' : '不支持'],
    ['完成度', '只按可配置槽位计算（基础形象）'],
  ]
  return (
    <div className="pane">
      <header className="pane-head">
        <div className="page-head-text">
          <h1 className="page-title">系统</h1>
          <p className="page-lead">能力边界和本地存储。这里只写已经审计过的事实。</p>
        </div>
      </header>
      <div className="pane-scroll">
        <section className="spec">
          <h2 className="section-title">运行时形象</h2>
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
            </div>
          </div>
        </section>
        <section className="spec">
          <h2 className="section-title">能力矩阵</h2>
          <table className="data-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field-hint">
            {capsSource}
            idle、waking、working、making_something、milestone_level_up 由 Muse 运行时自动驱动，只读展示。
            listening、thinking、speaking、error 不是独立槽位。
          </p>
        </section>
        <section className="spec">
          <h2 className="section-title">存储</h2>
          <p className="prose">
            SQLite 是唯一权威元数据，JSON 是可导出副本。素材按 UUID 目录存放，保存时计算 SHA-256。
            清除 Muse 头像不会清理本地资产库。
          </p>
        </section>
      </div>
    </div>
  )
}
