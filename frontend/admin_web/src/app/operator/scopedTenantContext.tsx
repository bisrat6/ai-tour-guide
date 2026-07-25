import { createContext, useContext } from 'react'

export type ScopedTenantContextValue = {
  readonly isScoped: boolean
  readonly museumId: string | null
  readonly museumName: string | null
  readonly operatorEmail: string | null
}

export const scopedTenantContext = createContext<ScopedTenantContextValue>({
  isScoped: false,
  museumId: null,
  museumName: null,
  operatorEmail: null,
})

export function useScopedTenantContext(): ScopedTenantContextValue {
  return useContext(scopedTenantContext)
}
