import type { CharacterProfile } from '../shared'
import { Icon } from './icons'
import { Badge, Button, StatusMark } from './ui'
import { RuntimeMedia, sourceFromCoverUrl, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * Character Identity Plinth — Sticky portrait showcase + activation & metadata actions.
 * `.active-profile-title` wraps freely across all widths (390px safe).
 */
export function Hero({
  profile,
  isActive,
  coverUrl,
  onActivate,
  onDeactivate,
  onEditInfo,
  onJumpSettings,
  onPreview,
  activating,
  deactivating,
}: {
  profile: CharacterProfile
  isActive: boolean
  coverUrl: string
  onActivate: () => void
  onDeactivate: () => void
  onEditInfo: () => void
  onJumpSettings: () => void
  onPreview: (source: RuntimeMediaSource, label: string) => void
  activating: boolean
  deactivating: boolean
}) {
  const coverSource = sourceFromCoverUrl(coverUrl, `${profile.name} 主视觉`)

  return (
    <header className="hero-plinth">
      <div className="hero-portrait-stage">
        <RuntimeMedia
          source={coverSource}
          badge={false}
          emptyTitle="暂无封面"
          emptyNote="本地没有运行时原图，见系统页说明。"
          onActivate={(s) => onPreview(s, `${profile.name}${profile.subtitle ? ` · ${profile.subtitle}` : ''}`)}
        />
        <div className="hero-portrait-badges">
          {isActive ? <Badge tone="accent">当前激活</Badge> : <span />}
          {profile.archivedAt ? <Badge tone="warn">已归档</Badge> : null}
        </div>
        {coverSource ? (
          <span className="hero-zoom-hint" aria-hidden>
            <Icon name="expand" size={14} />
          </span>
        ) : null}
      </div>

      <div className="hero-body">
        <div className="stack-sm">
          <h1 className="active-profile-title">
            {profile.name}
            {profile.subtitle ? <span className="title-aside"> · {profile.subtitle}</span> : null}
          </h1>
          {profile.description ? <p className="prose">{profile.description}</p> : null}
        </div>

        <div className="cluster">
          <StatusMark tone={isActive ? 'good' : 'neutral'} label={isActive ? '已激活 · 本地记录' : '未激活'} />
          {profile.tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>

        <div className="hero-actions">
          {isActive ? (
            <Button variant="outline" onClick={onDeactivate} disabled={deactivating} aria-busy={deactivating}>
              <Icon name="power" size={15} />
              {deactivating ? '解除中…' : '解除当前激活'}
            </Button>
          ) : (
            <Button variant="accent" onClick={onActivate} disabled={activating || Boolean(profile.archivedAt)} aria-busy={activating}>
              <Icon name="check" size={15} />
              {activating ? '激活中…' : '激活此角色'}
            </Button>
          )}
          <div className="hero-actions-row">
            <Button variant="outline" size="sm" onClick={onEditInfo}>
              <Icon name="edit" size={14} />
              编辑资料
            </Button>
            <Button variant="outline" size="sm" onClick={onJumpSettings}>
              <Icon name="sliders" size={14} />
              角色设定
            </Button>
          </div>
        </div>

        <p className="hero-note">
          激活仅写入本地记录与设定快照，不直接改写 Muse 运行时头像；运行时同步仍走候选流程。
        </p>
      </div>
    </header>
  )
}
