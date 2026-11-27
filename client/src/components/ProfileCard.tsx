import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Badge, Button, MediaImage, StatusMark } from './ui'

/**
 * Library card — cover-first. No cover uses the runtime base image.
 * Never a single-character placeholder.
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
    <article className="wall-card" data-active={isActive ? 'true' : 'false'}>
      <Button
        variant="ghost"
        size="sm"
        className="fav-btn"
        data-on={profile.favorite ? 'true' : 'false'}
        aria-label={profile.favorite ? '取消收藏' : '收藏'}
        onClick={onToggleFavorite}
      >
        <Icon name={profile.favorite ? 'starFill' : 'star'} size={15} />
      </Button>
      <button
        type="button"
        className="wall-card-hit"
        onClick={onOpen}
        aria-label={`打开 ${profile.name} · ${profile.subtitle ?? ''}`}
      >
        <div className="media-poster">
          <MediaImage
            src={cover}
            alt={`${profile.name} 封面`}
            fallback={
              <div className="media-empty">
                <Icon name="mark" size={36} />
              </div>
            }
          />
          {isActive ? (
            <span className="media-badges">
              <Badge tone="good">当前激活</Badge>
            </span>
          ) : null}
          <span className="open-chip">
            打开
            <Icon name="arrowRight" size={14} />
          </span>
          <div className="poster-caption">
            <h3 className="card-title">{profile.name}</h3>
            {profile.subtitle ? <p className="meta">{profile.subtitle}</p> : null}
          </div>
        </div>
        <div className="card-body">
          {profile.description ? <p className="prose clamp-2">{profile.description}</p> : null}
          <div className="split">
            <StatusMark tone={configured >= total ? 'good' : 'warn'} label={`状态 ${configured}/${total}`} />
            <span className="meta">{pct}%</span>
          </div>
          <div className="progress" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          {profile.tags.length ? (
            <div className="cluster">
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
