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
      {url ? (
        <img src={url} alt={label} className="max-h-[70vh] w-full rounded-[var(--radius-lg)] object-contain bg-[var(--color-surface-3)]" />
      ) : (
        <p className="text-sm text-[var(--color-ink-3)]">暂无图片。</p>
      )}
    </Modal>
  )
}
