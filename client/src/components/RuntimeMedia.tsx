import { useEffect, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { Icon, type IconName } from './icons'

/**
 * RuntimeMedia — 全站唯一的媒体展示组件。
 *
 * 响应式跟随日光画室 / 暗房放映主题切换：深色模式下自动切换
 * darkUrl（如 idle-dark.mp4），浅色模式下播放浅色原版。
 * 加载失败时回退原版或 poster，绝不留无说明黑框。
 */

export type RuntimeMediaKind = 'video' | 'image'

export interface RuntimeMediaSource {
  kind: RuntimeMediaKind
  url: string
  posterUrl?: string | null
  darkUrl?: string | null
  label: string
  alt: string
}

const VIDEO_EXT = /\.(mp4|webm)$/i
const IMAGE_EXT = /\.(webp|png|jpe?g|gif)$/i

export function mediaKindFromUrl(url: string): RuntimeMediaKind | null {
  if (VIDEO_EXT.test(url)) return 'video'
  if (IMAGE_EXT.test(url)) return 'image'
  return null
}

/** 本地素材行 → 展示源 */
export function sourceFromAsset(
  a: { url?: string | null; mediaType?: string; format?: string },
  labelPrefix = '本地素材',
): RuntimeMediaSource | null {
  if (!a.url) return null
  const kind = a.mediaType === 'video' || VIDEO_EXT.test(a.url) ? 'video' : 'image'
  return {
    kind,
    url: a.url,
    label: `${labelPrefix} · ${kind === 'video' ? '视频' : '图片'}`,
    alt: labelPrefix,
  }
}

/** 封面 URL → 展示源 */
export function sourceFromCoverUrl(url: string, alt: string): RuntimeMediaSource | null {
  const kind = mediaKindFromUrl(url)
  if (!kind) return null
  const isRuntimeBase = /(^|\/)assets\/runtime\/base\.webp$/.test(url)
  return {
    kind,
    url,
    label: isRuntimeBase
      ? '静态帧 · Muse 运行时'
      : kind === 'video'
        ? '封面 · 本地素材 · 视频'
        : '封面 · 本地素材 · 图片',
    alt,
  }
}

export type RuntimeMediaMode = 'autoplay' | 'controls' | 'still'

export function RuntimeMedia({
  source,
  className = 'media-img',
  badge = true,
  emptyTitle = '暂无画面',
  emptyNote,
  emptyIcon = 'image',
  onActivate,
  mode = 'autoplay',
}: {
  source: RuntimeMediaSource | null
  className?: string
  badge?: boolean
  emptyTitle?: string
  emptyNote?: string
  emptyIcon?: IconName
  onActivate?: (source: RuntimeMediaSource) => void
  mode?: RuntimeMediaMode
}) {
  const { dark } = useTheme()
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    setFailed(null)
  }, [source?.url, source?.darkUrl, dark])

  if (!source) {
    return (
      <div className="media-empty">
        <Icon name={emptyIcon} size={26} />
        <span className="media-empty-title">{emptyTitle}</span>
        {emptyNote ? <span className="media-empty-note">{emptyNote}</span> : null}
      </div>
    )
  }

  const playUrl =
    dark && source.darkUrl && failed !== source.darkUrl
      ? source.darkUrl
      : failed !== source.url
        ? source.url
        : null
  const poster = source.posterUrl ?? null
  const posterFailed = poster !== null && failed === poster

  const usingDarkVideo = Boolean(dark && source.darkUrl && playUrl === source.darkUrl)
  const effectivePoster = usingDarkVideo ? undefined : (poster ?? undefined)

  let media: React.ReactNode
  if (playUrl) {
    media =
      source.kind === 'video' ? (
        <video
          key={playUrl}
          className={`${className} media-video`}
          src={playUrl}
          poster={effectivePoster}
          autoPlay={mode !== 'still'}
          loop={mode !== 'still'}
          muted={mode === 'autoplay' || mode === 'still'}
          controls={mode === 'controls'}
          playsInline
          preload={mode === 'still' ? 'auto' : 'metadata'}
          onError={() => setFailed(playUrl)}
        />
      ) : (
        <img
          className={className}
          src={playUrl}
          alt={source.alt}
          loading="lazy"
          onError={() => setFailed(playUrl)}
        />
      )
  } else if (poster && !posterFailed) {
    media = (
      <img
        className={className}
        src={poster}
        alt={source.alt}
        loading="lazy"
        onError={() => setFailed(poster)}
      />
    )
  } else {
    return (
      <div className="media-empty">
        <Icon name={emptyIcon} size={26} />
        <span className="media-empty-title">媒体加载失败</span>
        <span className="media-empty-note">该媒体文件无法播放或显示，请检查文件是否存在。</span>
      </div>
    )
  }

  const kindBadge = badge ? <span className="media-kind">{source.label}</span> : null
  if (onActivate) {
    return (
      <button
        type="button"
        className="media-hit"
        onClick={() => onActivate(source)}
        aria-label={`预览 ${source.alt}`}
      >
        {media}
        {kindBadge}
      </button>
    )
  }
  return (
    <>
      {media}
      {kindBadge}
    </>
  )
}
