import { Button, Modal } from './ui'

/** Every destructive action passes through this confirmation dialog. */
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
      <div className="stack">
        <p className="prose">{body}</p>
        <p className="meta">已激活配置引用的素材不可删除；删除角色卡前须先解除激活。</p>
        <div className="action-row end">
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
      </div>
    </Modal>
  )
}
