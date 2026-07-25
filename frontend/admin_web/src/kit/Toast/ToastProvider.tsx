import type { ReactElement, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'

import { ToastContext } from './toastContext.ts'
import { ToastRegion } from './ToastRegion.tsx'
import type { Toast, ToastContextValue, ToastInput } from './Toast.types.ts'

function createToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export type ToastProviderProps = {
  readonly children: ReactNode
  readonly max?: number
  readonly placement?: 'bottom-end' | 'dock'
}

/** Holds toast state and renders the fixed notification region. */
export function ToastProvider({
  children,
  max = 3,
  placement = 'bottom-end',
}: ToastProviderProps): ReactElement {
  const [toasts, setToasts] = useState<readonly Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const show = useCallback(
    (input: ToastInput): string => {
      const id = createToastId()
      const toast: Toast = { ...input, id }
      setToasts((current) => {
        const next = [...current, toast]
        return next.length > max ? next.slice(next.length - max) : next
      })
      return id
    },
    [max],
  )

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss, dismissAll }),
    [show, dismiss, dismissAll],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} placement={placement} max={max} />
    </ToastContext.Provider>
  )
}
