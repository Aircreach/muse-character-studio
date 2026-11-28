import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Badge, Button } from './ui'
import { RuntimeMedia, sourceFromCoverUrl } from './RuntimeMedia'

/**
 * Gil Huybrecht × Gina Nguyen Archival Gallery Plate.
 * Sharp 0px framing, Swiss top micro-index (`01`, `02`), uncropped passe-partout
 * artwork canvas, and hover group-spotlight dimming controlled by parent `.wall-grid`.
 */
export function ProfileCard({
  profile,
  index,
  isActive,
  onOpen,
  onToggleFavorite,
  onRestore,
}: {
  profile: CharacterProfile
  index: number
  isActive: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  onRestore?: () => void
}) {
  const configured = profile.progress?.configured ?? 0
  const total = profile.progress?.total ?? 1
  const pct = Math.round((configured / Math.max(total, 1)) * 100)
  const cover = profile.coverUrl ?? '/assets/runtime/base.webp'
  const coverSource = sourceFromCoverUrl(cover, `${profile.name} 封面`)
  const plateIndex = String(index).padStart(2, '0')

  return (
    <article
      className="gallery-plate"
      data-active={isActive ? 'true' : 'false'}
      data-archived={profile.archivedAt ? 'true' : 'false'}
    >
      <div className="plate-top-meta">
        <span className="plate-top-name">{profile.name}</span>
        <span className="plate-top-index">
          {isActive ? `ACTIVE // ${plateIndex}` : `NO.${plateIndex}`}
        </span>
      </div>

      <div className="plate-overlay-tools">
        {profile.archivedAt && onRestore ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onRestore()
            }}
          >
            <Icon name="restore" size={13} />
            恢复
          </Button>
        ) : null}
        <button
          type="button"
          className="fav-square"
          data-on={profile.favorite ? 'true' : 'false'}
          aria-label={profile.favorite ? '取消收藏' : '收藏'}
          aria-pressed={profile.favorite}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Icon name={profile.favorite ? 'starFill' : 'star'} size={13} />
        </button>
      </div>

      <button
        type="button"
        className="plate-btn"
        onClick={onOpen}
        aria-label={`打开 ${profile.name}${profile.subtitle ? ` · ${profile.subtitle}` : ''}`}
      >
        <div className="plate-canvas">
          <RuntimeMedia
            source={coverSource}
            badge={false}
            emptyTitle="暂无封面"
            emptyNote="进入画室配置基础形象。"
          />
        </div>

        <div className="plate-bottom">
          <div className="plate-subtitle-row">
            <span className="plate-sub-label">{profile.subtitle || '默认人格'}</span>
            <span className="mono">
              {configured}/{total}
            </span>
          </div>
          <p className="plate-desc">
            {profile.description?.trim() || '尚未填写人格摘要，点击进入画室编辑。'}
          </p>
          <div className="cluster" style={{ gap: 6 }}>
            {isActive ? <Badge tone="accent">当前激活</Badge> : null}
            {profile.archivedAt ? <Badge tone="warn">已归档</Badge> : null}
            {profile.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
            {profile.tags.length === 0 && !isActive && !profile.archivedAt ? (
              <span className="mono">ID {profile.id.slice(-6).toUpperCase()}</span>
            ) : null}
          </div>
          <div className="plate-progress" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>
    </article>
  )
}
