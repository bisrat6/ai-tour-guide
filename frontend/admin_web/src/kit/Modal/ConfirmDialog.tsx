import type { ReactElement } from 'react'
import { useRef } from 'react'

import { Button } from '../Button/Button.tsx'
import { Modal } from './Modal.tsx'
import type { ConfirmDialogProps } from './Modal.types.ts'

/** Confirmation dialog — danger tone defaults initial focus to Cancel. */
export function ConfirmDialog({
  open,
  title,
  entityName,
  consequence,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
  returnFocusTo,
}: ConfirmDialogProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const initialFocusTo = tone === 'danger' ? cancelRef : confirmRef

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      {...(returnFocusTo !== undefined ? { returnFocusTo } : {})}
      initialFocusTo={initialFocusTo}
      dismissOnScrim={false}
      size="sm"
      footer={
        <>
          <Button ref={cancelRef} tone="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            tone={tone === 'danger' ? 'danger' : 'primary'}
            busy={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body-large">
        <span className="museum-name">{entityName}</span> {consequence}
      </p>
    </Modal>
  )
}
