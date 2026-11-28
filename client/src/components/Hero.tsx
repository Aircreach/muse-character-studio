import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Badge, Button, StatusMark } from './ui'
import { RuntimeMedia, sourceFromCoverUrl } from './RuntimeMedia'

/**
 * Workspace inspector — image on top, actions under it.
 * Title wraps: never truncate `.active-profile-title` (390px fix).
 * The cover renders through RuntimeMedia, so a video cover plays
 * instead of showing a broken image.
 */
export function Hero({
  profile,
  isActive,
  coverUrl,
  onActivate,
  onEditProfile,
  activating,
}: {
  profile: CharacterProfile
  isActive: boolean
  coverUrl: string
  onActivate: () => void
  onEditProfile: () => void
  activating: boolean
}) {
  const coverSource = sourceFromCoverUrl(coverUrl, `${profile.name} 主视觉`)
  return (
    <header className="panel inspector">
      <div className="media-portrait">
        {coverSource ? (
          <RuntimeMedia source={coverSource} emptyTitle="暂无封面" emptyNote="本地没有运行时原图，见系统页说明。" />
        ) : (
          <div className="plate-void" />
        )}
        {isActive ? (
          <span className="media-badges">
            <Badge tone="good">当前激活</Badge>
          </span>
        ) : null}
      </div>
      <div className="card-body">
        <h2 className="active-profile-title">
          {profile.name}
          {profile.subtitle ? <span className="title-aside"> · {profile.subtitle}</span> : null}
        </h2>
        {profile.description ? <p className="prose">{profile.description}</p> : null}
        <div className="cluster">
          <StatusMark tone={isActive ? 'good' : 'neutral'} label={isActive ? '已激活 · 本地记录' : '未激活'} />
          {profile.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        <div className="inspector-actions">
          <Button variant={isActive ? 'outline' : 'primary'} onClick={onActivate} disabled={activating || isActive} aria-busy={activating}>
            <Icon name="check" />
            {activating ? '激活中…' : isActive ? '已激活' : '激活此角色'}
          </Button>
          <Button variant="outline" onClick={onEditProfile}>
            <Icon name="sliders" />
            编辑资料
          </Button>
        </div>
        <p className="meta">
          激活只写本地记录与设定快照，不直接改 Muse 运行时头像；运行时同步仍走候选流程（原图恢复用换文件法）。
        </p>
      </div>
    </header>
  )
}
