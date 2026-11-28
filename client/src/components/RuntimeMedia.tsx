import { useState } from 'react'
import { Icon, type IconName } from './icons'

/**
 * RuntimeMedia — 全站唯一的媒体展示组件。
 *
 * 画廊、封面、参考素材、预览里的每一张图/一段视频都走这里，组件内部
 * 按类型判断怎么播、怎么标，调用方不再自己拼 <img> / <video>：
 *
 * - video（mp4/webm）：<video autoplay loop muted playsInline>，有
 *   poster 时用静态帧作封面；深色界面有 darkUrl 时播深色版，没有就
 *   回退浅色版。加载失败时回退 poster，再失败才显示占位。
 * - image（webp/png/jpeg/gif）：<img>；深色版同理回退。
 * - source 为 null（无媒体）：绝不留黑框，渲染带图标 + 标题 + 说明
 *   的占位（.media-empty），调用方必须给 emptyTitle/emptyNote 写清
 *   为什么没有——“非独立槽位”和“暂无运行时画面”是两种不同的没有。
 *
 * 每个媒体都带标识（右上角 .media-kind 徽标）：类型 + 来源，例如
 * “视频 · Muse 运行时”“静态帧 · Muse 运行时”“本地素材 · 视频”。
 * 深色/浅色取自 <html class="dark">（本应用强制深色，无运行时切换，
 * 读一次即可）。
 */

export type RuntimeMediaKind = 'video' | 'image'

export interface RuntimeMediaSource {
  kind: RuntimeMediaKind
  url: string
  posterUrl?: string | null
  darkUrl?: string | null
  /** 徽标文字，例如 “视频 · Muse 运行时”“本地素材 · 图片” */
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

function isDarkDocument(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

/** 本地素材行 → 展示源；label 按来源与类型写明。 */
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

/**
 * 封面 URL → 展示源。运行时原图（/assets/runtime/base.webp）单独标注
 * 来源，不冒充本地素材；其余按扩展名判断，视频封面也能播。
 */
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

export function RuntimeMedia({
  source,
  className = 'media-img',
  badge = true,
  emptyTitle = '暂无画面',
  emptyNote,
  emptyIcon = 'image',
  onActivate,
}: {
  source: RuntimeMediaSource | null
  className?: string
  /** 是否在右上角显示类型/来源徽标；双图对照等已有文字标注处可关掉。 */
  badge?: boolean
  emptyTitle?: string
  emptyNote?: string
  emptyIcon?: IconName
  onActivate?: (source: RuntimeMediaSource) => void
}) {
  const [dark] = useState(isDarkDocument)
  const [failed, setFailed] = useState<string | null>(null)

  if (!source) {
    return (
      <div className="media-empty">
        <Icon name={emptyIcon} size={28} />
        <span className="card-title">{emptyTitle}</span>
        {emptyNote ? <span className="media-empty-note">{emptyNote}</span> : null}
      </div>
    )
  }

  // 播放地址：深色版优先；失败后回退浅色版；两者都失败时走 poster/占位。
  const playUrl =
    dark && source.darkUrl && failed !== source.darkUrl
      ? source.darkUrl
      : failed !== source.url
        ? source.url
        : null
  const poster = source.posterUrl ?? null
  const posterFailed = poster !== null && failed === poster

  let media: React.ReactNode
  if (playUrl) {
    media =
      source.kind === 'video' ? (
        <video
          key={playUrl}
          className={`${className} media-video`}
          src={playUrl}
          poster={poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(playUrl)}
        />
      ) : (
        <img className={className} src={playUrl} alt={source.alt} loading="lazy" onError={() => setFailed(playUrl)} />
      )
  } else if (poster && !posterFailed) {
    media = (
      <img className={className} src={poster} alt={source.alt} loading="lazy" onError={() => setFailed(poster)} />
    )
  } else {
    return (
      <div className="media-empty">
        <Icon name={emptyIcon} size={28} />
        <span className="card-title">媒体加载失败</span>
        <span className="media-empty-note">该媒体文件无法播放或显示，请检查文件是否存在。</span>
      </div>
    )
  }

  const kindBadge = badge ? <span className="media-kind">{source.label}</span> : null
  if (onActivate) {
    return (
      <button type="button" className="media-hit" onClick={() => onActivate(source)} aria-label={`预览 ${source.alt}`}>
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
