import { Modal } from './ui'
import { RuntimeMedia, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * High-resolution preview — click any media card to open it.
 * 预览走 RuntimeMedia（controls 模式）：传完整的展示源，深色预览播
 * darkUrl、失败回退 poster；绝不只传 url 再按扩展名拼裸 <video>/<img>。
 */
export function PreviewDialog({
  open,
  onOpenChange,
  source,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 完整的展示源（含 darkUrl / posterUrl），由调用方从 RuntimeMedia 传来。 */
  source: RuntimeMediaSource | null
  label: string
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={label} wide>
      <RuntimeMedia
        source={source}
        mode="controls"
        className="preview-media"
        badge={false}
        emptyTitle="暂无媒体"
        emptyNote="该媒体没有可预览的文件。"
      />
    </Modal>
  )
}
