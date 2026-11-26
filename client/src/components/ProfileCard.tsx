import type { CharacterProfile } from '../shared'
import { RUNTIME_BASE_MD5 } from '../shared'
import { Badge, StatusMark } from './ui'

/**
 * Library card — cover-first, never a single-character placeholder.
 * No cover? Use the built-in runtime base image (v1, MD5 2fb6…) as the
 * neutral cover, with a “运行时原图” note. Never render a big serif
 * first character on a grey block.
 */
export function ProfileCard({
  profile,
  isActive,
  onOpen,
  onToggleFavorite,
}: {
  profile: CharacterProfile
  isActive: boolean
  onOpen: () => void
  onToggleFavorite: () => void
}) {
  const configured = profile.progress?.configured ?? 0
  const total = profile.progress?.total ?? 1
  const pct = Math.round((configured / Math.max(total, 1)) * 100)
  const cover = profile.coverUrl ?? '/assets/runtime/base.webp'
  return (
    <article className="card group overflow-hidden text-left transition-shadow hover:shadow-[var(--shadow-md)]">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`打开 ${profile.name} · ${profile.subtitle ?? ''}`}>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-surface-3)]">
          <img
            src={cover}
            alt={`${profile.name} 封面`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          {isActive ? (
            <span className="absolute left-3 top-3 badge-good">当前激活</span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            aria-label={profile.favorite ? '取消收藏' : '收藏'}
            className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink-2)] shadow-[var(--shadow-sm)]"
          >
            {profile.favorite ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg leading-snug text-[var(--color-ink)]">{profile.name}</h3>
          {profile.subtitle ? <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{profile.subtitle}</p> : null}
          {profile.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-2)]">{profile.description}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <StatusMark tone={configured >= total ? 'good' : 'warn'} label={`状态 ${configured}/${total}`} />
            <span className="text-xs tabular-nums text-[var(--color-ink-3)]">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-4)]">
            ID 是身份，名称可重复 · 封面 MD5 {RUNTIME_BASE_MD5.slice(0, 8)}…
          </p>
          {profile.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.tags.slice(0, 3).map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </button>
    </article>
  )
}
