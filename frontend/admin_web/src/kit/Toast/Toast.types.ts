import type { StateAction } from '../types.ts'

export type ToastTone = 'success' | 'danger' | 'neutral'

export type ToastInput = {
  readonly tone: ToastTone
  /** One sentence, past tense for success: "Room published." */
  readonly message: string
  readonly detail?: string
  readonly action?: StateAction
  /** ms, or 'persist'. Defaults: success 6000, neutral 6000, danger 'persist'. */
  readonly duration?: number | 'persist'
}

export type Toast = ToastInput & { readonly id: string }

export type ToastContextValue = {
  readonly show: (toast: ToastInput) => string
  readonly dismiss: (id: string) => void
  readonly dismissAll: () => void
}

export type ToastRegionProps = {
  readonly toasts: readonly Toast[]
  readonly onDismiss: (id: string) => void
  /** Newest first at the bottom-right; 'dock' bottom-centre below 768px. */
  readonly placement?: 'bottom-end' | 'dock'
  readonly max?: number
}
