/**
 * Which museum the tenant surface is currently acting on.
 *
 * Two routes reach the same pages. Under `/app` a museum admin works on the
 * museum its token names, and under `/operator/tenant/:museumId` a system admin
 * works on one named in the URL — whose token names none. Resolving both here
 * keeps every caller from repeating the fallback and getting it subtly wrong.
 *
 * Null means there is nothing to act on, which is a system admin at `/app`
 * rather than an error.
 */

import { useScopedTenantContext } from '../operator/scopedTenantContext.tsx'
import { useAuth } from './sessionContext.ts'

export function useActiveMuseumId(): string | null {
  const { museumId: scopedMuseumId } = useScopedTenantContext()
  const { session } = useAuth()
  return scopedMuseumId ?? session?.museumId ?? null
}
