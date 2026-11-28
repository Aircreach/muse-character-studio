import { Modal } from './ui'
import { mediaKindFromUrl } from './RuntimeMedia'

/** High-resolution preview — click any media card to open it. Video plays with controls. */
export function PreviewDialog({
  open,
  onOpenChange,
  url,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string | null
  label: string
}) {
  const isVideo = url !== null && mediaKindFromUrl(url) === 'video'
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={label} wide>
      {url ? (
        isVideo ? (
          <video className="preview-video" src={url} controls autoPlay loop playsInline />
        ) : (
          <img className="preview-img" src={url} alt={label} />
        )
      ) : (
        <p className="meta">暂无图片。</p>
      )}
    </Modal>
  )
}
