import { useContext } from 'react'

import { ToastContext } from './toastContext.ts'
import type { ToastContextValue } from './Toast.types.ts'

/** Access toast show / dismiss helpers from ToastProvider. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (value === null) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return value
}
