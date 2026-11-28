import { Modal } from './ui'
import { RuntimeMedia, type RuntimeMediaSource } from './RuntimeMedia'

/**
 * Exhibition Lightbox Preview — renders through RuntimeMedia in controls mode
 * so videos are playable with audio controls and reactive dark/light variants.
 */
export function PreviewDialog({
  open,
  onOpenChange,
  source,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: RuntimeMediaSource | null
  label: string
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={label} wide>
      <div className="preview-stage">
        <RuntimeMedia
          source={source}
          mode="controls"
          className="preview-media"
          badge={false}
          emptyTitle="暂无媒体"
          emptyNote="该媒体没有可预览的文件。"
        />
      </div>
    </Modal>
  )
}
