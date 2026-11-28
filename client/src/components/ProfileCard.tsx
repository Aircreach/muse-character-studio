import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Button } from './ui'
import { RuntimeMedia, sourceFromCoverUrl } from './RuntimeMedia'

/**
 * Library card — cover-first. No cover uses the runtime base image.
 * Never a single-character placeholder.
 * The cover renders through RuntimeMedia (video covers play); archived
 * cards are dimmed, flagged, and get a restore button.
 */
export function ProfileCard({
  profile,
  isActive,
  onOpen,
  onToggleFavorite,
  onRestore,
}: {
  profile: CharacterProfile
  isActive: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  /** Archived cards only: restore the card via restoreProfile. */
  onRestore?: () => void
}) {
  const configured = profile.progress?.configured ?? 0
  const total = profile.progress?.total ?? 1
  const pct = Math.round((configured / Math.max(total, 1)) * 100)
  const cover = profile.coverUrl ?? '/assets/runtime/base.webp'
  const coverSource = sourceFromCoverUrl(cover, `${profile.name} 封面`)
  return (
    <article className="wall-card" data-active={isActive ? 'true' : 'false'} data-archived={profile.archivedAt ? 'true' : 'false'}>
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
      {profile.archivedAt && onRestore ? (
        <Button variant="outline" size="sm" className="restore-btn" onClick={onRestore}>
          恢复
        </Button>
      ) : null}
      <button
        type="button"
        className="wall-card-hit"
        onClick={onOpen}
        aria-label={`打开 ${profile.name} · ${profile.subtitle ?? ''}`}
      >
        <div className="media-poster">
          {coverSource ? (
            <RuntimeMedia source={coverSource} />
          ) : (
            <div className="plate-void">
              <span className="plate-void-name">{profile.name}</span>
            </div>
          )}
          {isActive ? <span className="plate-flag">当前激活</span> : null}
          {profile.archivedAt ? <span className={isActive ? 'plate-flag plate-flag-second' : 'plate-flag'}>已归档</span> : null}
          <div className="poster-caption">
            <h3 className="card-title">{profile.name}</h3>
            <div className="poster-line">
              <p className="poster-sub">{profile.subtitle || '未写副标题'}</p>
              <span className="poster-pct">{pct}%</span>
            </div>
            {profile.tags.length ? <p className="poster-tags">{profile.tags.slice(0, 3).join('  ')}</p> : null}
          </div>
          <div className="plate-meter" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>
    </article>
  )
}
