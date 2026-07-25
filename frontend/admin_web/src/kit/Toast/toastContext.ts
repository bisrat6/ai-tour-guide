import { createContext } from 'react'

import type { ToastContextValue } from './Toast.types.ts'

export const ToastContext = createContext<ToastContextValue | null>(null)
