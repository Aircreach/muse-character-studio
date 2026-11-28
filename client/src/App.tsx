import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, STUDIO_KEY } from './api'
import {
  RUNTIME_BASE_BYTES,
  RUNTIME_BASE_MD5,
  RUNTIME_BASE_SIZE,
  type Capabilities,
  type CharacterProfile,
  type View,
} from './shared'
import { Icon } from './components/icons'
import { ExhibitionHome } from './components/ExhibitionHome'
import { ProfileCard } from './components/ProfileCard'
import { RuntimeMedia, sourceFromCoverUrl, type RuntimeMediaSource } from './components/RuntimeMedia'
import { Shell, type NoticeItem } from './components/Shell'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  LoadingNote,
  MediaImage,
  Modal,
  Panel,
  SearchInput,
  Segmented,
  TextArea,
  TextInput,
} from './components/ui'
import { Workspace } from './Workspace'

export default function App() {
  const qc = useQueryClient()
  const [view, setView] = useState<View>({ kind: 'home' })
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const noticeId = useRef(0)

  const studio = useQuery({ queryKey: STUDIO_KEY, queryFn: () => api.getStudio({}) })
  const runtimeAssets = useQuery({
    queryKey: ['runtime-assets'],
    queryFn: () => api.getRuntimeAssets({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

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

  const allProfiles = studio.data?.profiles ?? []
  const filteredProfiles = useMemo(() => {
    return allProfiles.filter((profile) => {
      if (onlyFavorites && !profile.favorite) return false
      if (!query.trim()) return true
      const q = query.trim().toLowerCase()
      return (
        profile.name.toLowerCase().includes(q) ||
        (profile.subtitle ?? '').toLowerCase().includes(q) ||
        (profile.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [allProfiles, onlyFavorites, query])

  const runtimeMap = useMemo(() => {
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

  const connection = studio.isError ? 'error' : studio.data ? 'ready' : 'loading'

  const createProfile = useMutation({
    mutationFn: (input: { name: string; subtitle: string; description: string; tags: string[] }) =>
      api.createProfile(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: STUDIO_KEY })
      setCreateOpen(false)
      push('已创建新角色卡')
      setView({ kind: 'workspace', id: created.profile.id })
    },
    onError: (error) => push(`创建失败：${error instanceof Error ? error.message : '未知错误'}`),
  })

  return (
    <Shell
      view={view}
      profiles={allProfiles}
      activeProfileId={studio.data?.activeProfileId ?? null}
      connection={connection}
      toast={toast}
      notices={notices}
      onNavigate={setView}
    >
      {view.kind === 'home' ? (
        <ExhibitionHome
          profiles={allProfiles}
          activeProfileId={studio.data?.activeProfileId ?? null}
          runtimeMap={runtimeMap}
          loading={studio.isLoading}
          error={studio.isError}
          onOpenWorkspace={(id) => setView({ kind: 'workspace', id })}
          onOpenLibrary={() => setView({ kind: 'library' })}
          onOpenCreate={() => setCreateOpen(true)}
        />
      ) : view.kind === 'workspace' ? (
        <Workspace
          profileId={view.id}
          capabilities={studio.data?.capabilities ?? null}
          onBack={() => setView({ kind: 'library' })}
          onOpenProfile={(id) => setView({ kind: 'workspace', id })}
          onToast={push}
        />
      ) : view.kind === 'system' ? (
        <SystemView
          studioCapabilities={studio.data?.capabilities ?? null}
          runtimeCount={runtimeAssets.data?.items.length ?? 0}
        />
      ) : (
        <LibraryView
          allProfiles={allProfiles}
          profiles={filteredProfiles}
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
          onOpenCreate={() => setCreateOpen(true)}
        />
      )}

      {createOpen ? (
        <CreateProfileModal
          creating={createProfile.isPending}
          onClose={() => setCreateOpen(false)}
          onCreate={(input) => createProfile.mutate(input)}
        />
      ) : null}
    </Shell>
  )
}

function LibraryView(props: {
  allProfiles: CharacterProfile[]
  profiles: CharacterProfile[]
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
  onOpenCreate: () => void
}) {
  const [mode, setMode] = useState<'wall' | 'index'>('wall')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const previewProfile = useMemo(() => {
    if (props.profiles.length === 0) return null
    return (
      props.profiles.find((p) => p.id === hoveredId) ??
      props.profiles.find((p) => p.id === props.activeProfileId) ??
      props.profiles[0]
    )
  }, [hoveredId, props.activeProfileId, props.profiles])

  if (props.loading) return <LoadingNote>正在载入角色档案…</LoadingNote>

  if (props.error) {
    return (
      <div className="archive-canvas">
        <EmptyState title="档案加载失败" body="请刷新页面重试。数据保存在服务端，本地编辑草稿不会丢失。" />
      </div>
    )
  }

  return (
    <div className="archive-canvas">
      <header className="swiss-head">
        <div>
          <span className="mono">ARCHIVE // {String(props.profiles.length).padStart(2, '0')} OF {String(props.allProfiles.length).padStart(2, '0')}</span>
          <h1 className="swiss-title">角色档案</h1>
        </div>

        <p className="swiss-note">
          每张角色卡独立维护视觉图集与结构化人格手稿。悬停画廊墙可聚光检视，或切换至目录视图快速索引。
        </p>

        <div className="swiss-controls">
          <SearchInput
            placeholder="筛选名称或副标题"
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            aria-label="筛选角色卡"
          />
          <Segmented
            ariaLabel="收藏筛选"
            value={props.onlyFavorites ? 'fav' : 'all'}
            onChange={(value) => props.setOnlyFavorites(value === 'fav')}
            options={[
              { value: 'all', label: '全部' },
              { value: 'fav', label: '收藏', icon: 'star' },
            ]}
          />
          <Segmented
            ariaLabel="切换档案展示方式"
            value={mode}
            onChange={(value) => setMode(value as 'wall' | 'index')}
            options={[
              { value: 'wall', label: '画廊', icon: 'grid' },
              { value: 'index', label: '目录', icon: 'list' },
            ]}
          />
          <Button variant="primary" size="sm" onClick={props.onOpenCreate}>
            <Icon name="plus" size={14} />
            新建
          </Button>
        </div>
      </header>

      {props.profiles.length === 0 ? (
        <EmptyState
          title={props.filtered ? '没有匹配的角色卡' : '档案库尚无角色卡'}
          body={
            props.filtered
              ? '更换筛选关键词或取消收藏过滤以查看全部角色档案。'
              : '新建一张角色卡；空库时会自动种入原作人格与日常人格。'
          }
          action={
            props.filtered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  props.setQuery('')
                  props.setOnlyFavorites(false)
                }}
              >
                重置筛选
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={props.onOpenCreate}>
                <Icon name="plus" size={14} />
                新建角色卡
              </Button>
            )
          }
        />
      ) : mode === 'wall' ? (
        <div className="wall-grid" data-count={props.profiles.length}>
          {props.profiles.map((profile, idx) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              index={idx + 1}
              isActive={profile.id === props.activeProfileId}
              onOpen={() => props.onOpen(profile.id)}
              onToggleFavorite={() => props.onToggleFavorite(profile.id)}
              onRestore={profile.archivedAt ? () => props.onRestore(profile.id) : undefined}
            />
          ))}
        </div>
      ) : (
        /* Thomas Mamfredas-Inspired Editorial Work Index with Live Hover Plate */
        <div className="index-split">
          <div className="index-list" role="list" aria-label="角色目录索引">
            {props.profiles.map((profile, idx) => {
              const configured = profile.progress?.configured ?? 0
              const total = profile.progress?.total ?? 1
              const active = profile.id === props.activeProfileId
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="listitem"
                  className="index-row"
                  onMouseEnter={() => setHoveredId(profile.id)}
                  onFocus={() => setHoveredId(profile.id)}
                  onClick={() => props.onOpen(profile.id)}
                >
                  <span className="mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span style={{ fontWeight: 600 }}>{profile.name}</span>
                  <span style={{ color: 'var(--ink-2)' }}>{profile.subtitle || '默认人格'}</span>
                  <span className="cluster" style={{ gap: 5 }}>
                    {active ? <Badge tone="accent">激活</Badge> : null}
                    {profile.archivedAt ? <Badge tone="warn">归档</Badge> : null}
                    {!active && !profile.archivedAt && profile.tags.slice(0, 2).map((t) => (
                      <span key={t} className="tag-chip">{t}</span>
                    ))}
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>
                    {configured}/{total}
                  </span>
                </button>
              )
            })}
          </div>

          {previewProfile ? (
            <aside className="index-preview-box" aria-label="悬停角色画面预览">
              <RuntimeMedia
                source={sourceFromCoverUrl(
                  previewProfile.coverUrl ?? '/assets/runtime/base.webp',
                  `${previewProfile.name} 预览`,
                )}
                badge={false}
                emptyTitle="暂无封面"
                emptyNote="点击目录条目进入画室配置。"
              />
            </aside>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CreateProfileModal({
  creating,
  onClose,
  onCreate,
}: {
  creating: boolean
  onClose: () => void
  onCreate: (input: { name: string; subtitle: string; description: string; tags: string[] }) => void
}) {
  const [name, setName] = useState('黑岩射手')
  const [subtitle, setSubtitle] = useState('新人格')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')

  const handleSubmit = () => {
    const cleanName = name.trim()
    if (!cleanName) return
    const tags = tagsText
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12)
    onCreate({ name: cleanName, subtitle: subtitle.trim(), description: description.trim(), tags })
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="新建角色卡">
      <div className="stack">
        <p className="meta">创建后将直接进入该角色卡的画室，配置基础形象与 7 组结构化设定。</p>
        <Field label="角色名称">
          <TextInput value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="副标题">
          <TextInput
            value={subtitle}
            maxLength={120}
            placeholder="例如：战斗形态 / 校园日常"
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>
        <Field label="人格摘要（可选）">
          <TextArea
            rows={2}
            maxLength={2000}
            value={description}
            placeholder="简述这套人格的性格与视觉气质"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="标签（可选，逗号或顿号分隔）">
          <TextInput value={tagsText} placeholder="例如：冬日、温和" onChange={(e) => setTagsText(e.target.value)} />
        </Field>
        <div className="action-row end">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={creating || !name.trim()} onClick={handleSubmit}>
            <Icon name="plus" size={14} />
            {creating ? '创建中…' : '创建并进入画室'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SystemView({
  studioCapabilities,
  runtimeCount,
}: {
  studioCapabilities?: Capabilities | null
  runtimeCount: number
}) {
  const capsQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.getCapabilities({}),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const liveCaps = capsQuery.data?.capabilities ?? null
  const caps = liveCaps ?? studioCapabilities ?? null
  const capsSource = liveCaps
    ? '实时能力矩阵取自服务端 MuseRuntimeProvider.getCapabilities()。'
    : studioCapabilities
      ? 'getCapabilities 暂不可达，当前回退展示 getStudio 附带的能力矩阵。'
      : '尚未连接到后端能力接口。'

  const capabilityItems = caps
    ? [
        { label: '形象架构模式', value: caps.mode },
        { label: '静态图片', value: caps.staticImage ? '支持' : '不支持' },
        {
          label: '视频变体',
          value: caps.videoVariants ? (caps.darkModeVariants ? '支持（深浅双主题）' : '支持') : '不支持',
        },
        { label: '独立状态素材', value: caps.independentStateAssets ? '支持' : '未启用（自动派生）' },
        { label: '候选 ID 可复用', value: caps.candidateIdReusable ? '是' : '否（一次性凭证）' },
        { label: '候选激活流程', value: caps.candidateActivation ? '支持' : '不支持' },
        { label: '可用运行时状态', value: `${caps.availableStates.length} 个` },
        { label: '本地运行时媒体', value: runtimeCount > 0 ? `已挂载 ${runtimeCount} 项` : '未挂载' },
      ]
    : []

  const runtimeAvatar = caps?.runtimeAvatar

  return (
    <div className="system-wrap">
      <header className="swiss-head" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div>
          <span className="mono">SYSTEM // RUNTIME BOUNDARY & ADAPTER LEDGER</span>
          <h1 className="swiss-title">系统与运行时边界</h1>
          <p className="swiss-note">
            所有能力声明均由后端解耦的 MuseRuntimeProvider 动态提供；未实测的能力一律按不支持处理，绝不虚构。
          </p>
        </div>
      </header>

      <section className="system-hero" aria-label="运行时基准形象">
        <div className="system-base-frame">
          <MediaImage
            src="/assets/runtime/base.webp"
            alt="Muse 当前运行时基准头像"
            fallback={
              <div className="media-empty">
                <Icon name="image" size={24} />
                <span className="media-empty-title">未找到运行时原图</span>
              </div>
            }
          />
        </div>
        <div className="stack-sm">
          <div className="cluster">
            <Badge tone="accent">{runtimeAvatar?.label ?? 'v1 运行时原图'}</Badge>
            <Badge tone="good">MD5 已核验</Badge>
          </div>
          <h2 className="panel-title">黑岩射手 · 原作人格</h2>
          <p className="prose">
            {runtimeAvatar?.note ?? 'Muse 当前内置基准形象原图，用于无独立封面时的回退展示与本地导入校验。'}
          </p>
          <p className="mono">
            MD5 {runtimeAvatar?.md5 ?? RUNTIME_BASE_MD5} ·{' '}
            {runtimeAvatar ? `${runtimeAvatar.width}×${runtimeAvatar.height}` : RUNTIME_BASE_SIZE} ·{' '}
            {RUNTIME_BASE_BYTES.toLocaleString()} 字节
          </p>
        </div>
      </section>

      <Panel title="能力矩阵（单一事实来源）" note={capsSource}>
        {caps ? (
          <div className="stack">
            <div className="cap-grid">
              {capabilityItems.map((item) => (
                <div key={item.label} className="cap-item">
                  <span className="cap-label">{item.label}</span>
                  <span className="cap-value">{item.value}</span>
                </div>
              ))}
            </div>
            {caps.notes && caps.notes.length > 0 ? (
              <ul className="notes-list">
                {caps.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <EmptyState title="未获取到能力矩阵" body="请确认本地后端服务（端口 8787）正在运行。" />
        )}
      </Panel>

      <Panel title="解耦架构与本地存储" note="平台核心业务与 Muse 运行时交互通过独立适配器模块彻底隔离。">
        <p className="prose">
          后端通过 server/src/adapters/muse/ 抽象出 MuseRuntimeProvider 接口（本地注入 LocalMuseProvider，线上注入
          OnlineMuseProvider）。SQLite（server/data/studio.db）为唯一权威元数据存储，素材按 UUID 目录存放并计算 SHA-256；
          激活角色仅写入本地快照（providerStatus=local_record），不隐式改写 Muse 运行时头像或长期记忆。
        </p>
      </Panel>
    </div>
  )
}
