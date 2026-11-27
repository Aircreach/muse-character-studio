import { Modal } from './ui'

/** High-resolution preview — click any image card to open it. */
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
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={label} wide>
      {url ? <img className="preview-img" src={url} alt={label} /> : <p className="meta">暂无图片。</p>}
    </Modal>
  )
}
