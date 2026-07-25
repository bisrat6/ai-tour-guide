import type { ReactNode, RefObject } from 'react'
import type { KitState } from '../types.ts'

export type ModalProps = {
  readonly open: boolean
  readonly title: string
  /** Rendered as the first paragraph and wired to aria-describedby. */
  readonly description?: string
  readonly size?: 'sm' | 'md' | 'lg'
  readonly onClose: () => void
  /** Focus returns here. Defaults to whatever was focused before opening. */
  readonly returnFocusTo?: RefObject<HTMLElement | null>
  /** Where focus lands on open. Defaults to the first tabbable element. */
  readonly initialFocusTo?: RefObject<HTMLElement | null>
  readonly dismissOnScrim?: boolean
  readonly dismissOnEscape?: boolean
  readonly footer?: ReactNode
  readonly state?: KitState
  readonly children: ReactNode
}

export type ConfirmDialogProps = {
  readonly open: boolean
  /** e.g. "Suspend this museum?" */
  readonly title: string
  /** The entity by name. Required: a confirmation must name what it affects. */
  readonly entityName: string
  /** What will happen, in the user's terms. Required. */
  readonly consequence: string
  /** Must be the same verb as the control that opened this dialog. */
  readonly confirmLabel: string
  readonly cancelLabel?: string
  readonly tone?: 'primary' | 'danger'
  readonly busy?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly returnFocusTo?: RefObject<HTMLElement | null>
}
