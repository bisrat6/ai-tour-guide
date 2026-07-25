import type { ReactElement } from 'react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import styles from './Modal.module.css'

import { Button } from '../Button/Button.tsx'
import { CrossIcon } from '../internal/CrossIcon.tsx'
import { getTabbables } from '../internal/getTabbables.ts'
import { useBodyScrollLock } from '../internal/useBodyScrollLock.ts'
import { useDismiss } from '../internal/useDismiss.ts'
import { useFocusTrap } from '../internal/useFocusTrap.ts'
import { useReturnFocus } from '../internal/useReturnFocus.ts'
import { StateBlock } from '../State/StateBlock.tsx'
import { resolveState } from '../types.ts'
import type { ModalProps } from './Modal.types.ts'

let openModalCount = 0

function sizeClass(size: NonNullable<ModalProps['size']>): string {
  if (size === 'sm') return styles.sizeSm
  if (size === 'lg') return styles.sizeLg
  return ''
}

/** Modal dialog with focus trap, inert background and focus return. */
export function Modal({
  open,
  title,
  description,
  size = 'md',
  onClose,
  returnFocusTo,
  initialFocusTo,
  dismissOnScrim = true,
  dismissOnEscape = true,
  footer,
  state,
  children,
}: ModalProps): ReactElement | null {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const resolved = resolveState(state)

  useBodyScrollLock(open)
  useFocusTrap(dialogRef, open)
  useReturnFocus(open, returnFocusTo)

  useDismiss({
    enabled: open,
    onDismiss: onClose,
    containerRef: dialogRef,
    dismissOnEscape,
    dismissOnOutsidePress: dismissOnScrim,
  })

  useEffect(() => {
    if (!open) return

    if (import.meta.env.DEV && openModalCount > 0) {
      throw new Error('Nested modals are not supported in Phase 2.')
    }
    openModalCount += 1

    const root = document.getElementById('root')
    root?.setAttribute('inert', '')

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (dialog === null) return

      if (initialFocusTo?.current !== undefined && initialFocusTo.current !== null) {
        initialFocusTo.current.focus()
        return
      }

      const tabbables = getTabbables(dialog)
      if (tabbables.length > 0) {
        tabbables[0]!.focus()
        return
      }

      dialog.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      openModalCount = Math.max(0, openModalCount - 1)
      root?.removeAttribute('inert')
    }
  }, [open, initialFocusTo])

  if (!open) return null

  const dialog = (
    <div className={styles.scrim} onPointerDown={(event) => event.stopPropagation()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        tabIndex={-1}
        className={`${styles.dialog} ${sizeClass(size)}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={`${styles.title} text-subtitle`}>
            {title}
          </h2>
          <Button
            tone="ghost"
            iconOnly
            label="Close"
            icon={<CrossIcon />}
            onClick={onClose}
          />
        </header>

        <div className={styles.body}>
          {description !== undefined ? (
            <p id={descriptionId} className={`${styles.description} text-body-large`}>
              {description}
            </p>
          ) : null}

          {resolved.kind === 'loading' ? (
            <StateBlock state={resolved} size="region" announce={false} />
          ) : (
            children
          )}
        </div>

        {resolved.kind === 'failure' ? (
          <div className={styles.inlineFailure}>
            <StateBlock state={resolved} size="inline" />
          </div>
        ) : null}

        {footer !== undefined ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}
