import { Button, Modal } from './ui'

/** Every destructive action goes through this confirmation. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = '确认删除',
  onConfirm,
  busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  confirmLabel?: string
  onConfirm: () => void
  busy?: boolean
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm leading-relaxed text-[var(--color-ink-2)]">{body}</p>
      <p className="mt-2 text-xs text-[var(--color-ink-3)]">已激活配置引用的素材不可删除；删除角色卡前须先解除激活。</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
        >
          {busy ? '处理中…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
