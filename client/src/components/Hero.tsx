import type { CharacterProfile } from '../shared'
import { Badge, Button, StatusMark } from './ui'

/**
 * Workspace hero — image-first, not an admin header.
 * Title wraps on small screens: never `truncate` on this title.
 * (390px fix: the active-profile title was cut by 25px; see theme.css
 * `.active-profile-title`.)
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
  return (
    <header className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="grid gap-0 md:grid-cols-[320px_1fr]">
        <div className="relative min-h-[220px] bg-[var(--color-surface-3)] md:min-h-[280px]">
          <img src={coverUrl} alt={`${profile.name} 主视觉`} className="absolute inset-0 size-full object-cover" />
          {isActive ? <span className="absolute left-3 top-3 badge-good">当前激活</span> : null}
        </div>
        <div className="flex flex-col justify-between gap-4 p-5 sm:p-7">
          <div>
            <h1 className="active-profile-title font-display text-[28px] text-[var(--color-ink)] sm:text-3xl">
              {profile.name}
              {profile.subtitle ? <span className="text-[var(--color-ink-3)]"> · {profile.subtitle}</span> : null}
            </h1>
            {profile.description ? (
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-2)]">{profile.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <StatusMark tone={isActive ? 'good' : 'neutral'} label={isActive ? '已激活 · 本地记录' : '未激活'} />
              {profile.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant={isActive ? 'outline' : 'primary'} onClick={onActivate} disabled={activating || isActive}>
              {activating ? '激活中…' : isActive ? '已激活' : '激活此角色'}
            </Button>
            <Button variant="outline" onClick={onEditProfile}>
              编辑资料
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-ink-3)]">
            激活只写本地记录与设定快照，不直接改 Muse 运行时头像；运行时同步仍走候选流程（原图恢复用换文件法）。
          </p>
        </div>
      </div>
    </header>
  )
}
