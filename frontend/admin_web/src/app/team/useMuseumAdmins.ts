/**
 * A museum's administrator accounts.
 *
 * Shared by the tenant Team page and the operator Admins page, which read the
 * same route from opposite ends: one for its own museum, one across the fleet.
 *
 * What the account rows do *not* carry is worth stating, because both pages
 * used to show it: there is no display name, no status, and no way to remove or
 * suspend an account over HTTP. An account exists or it does not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import * as api from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import type { ApiAdminUser } from '../../api/types.ts'

export type AdminAccount = {
  readonly id: string
  readonly email: string
  readonly role: ApiAdminUser['role']
  readonly museumId: string | null
  readonly lastLoginAt: string | null
  readonly createdAt: string
}

export type LoadStatus = 'loading' | 'ready' | 'error'

export type AddAdminResult = { ok: true } | { ok: false; message: string }

const PAGE_SIZE = 200

/** A museum can have more administrators than one page holds only in theory. */
export async function fetchMuseumAdmins(museumId: string): Promise<readonly AdminAccount[]> {
  const accounts: AdminAccount[] = []
  let cursor: string | undefined

  do {
    const page = await api.listMuseumAdmins(museumId, {
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    })
    accounts.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  return accounts
}

/**
 * The best a display name can be. The backend stores no name, so this is a
 * derivation rather than data, and every surface showing it says so.
 */
export function displayNameFor(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatLastLogin(lastLoginAt: string | null): string {
  if (lastLoginAt === null) return 'Never signed in'
  const at = Date.parse(lastLoginAt)
  if (Number.isNaN(at)) return lastLoginAt

  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function useMuseumAdmins(museumId: string | null): {
  readonly admins: readonly AdminAccount[]
  readonly isLive: boolean
  readonly status: LoadStatus
  readonly loadError: string | null
  readonly reload: () => void
  readonly addAdmin: (input: { email: string; password: string }) => Promise<AddAdminResult>
} {
  const live = isLiveApi && museumId !== null

  const [admins, setAdmins] = useState<readonly AdminAccount[]>([])
  const [status, setStatus] = useState<LoadStatus>(live ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!live || museumId === null) {
      setAdmins([])
      setStatus('ready')
      setLoadError(null)
      return
    }

    let current = true
    setStatus('loading')
    setLoadError(null)

    fetchMuseumAdmins(museumId)
      .then((loaded) => {
        if (!current) return
        setAdmins(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setAdmins([])
        setStatus('error')
        setLoadError(isApiError(error) ? error.message : 'Could not load the administrators.')
      })

    return () => {
      current = false
    }
  }, [live, museumId, reloadToken])

  const addAdmin = useCallback(
    async ({ email, password }: { email: string; password: string }): Promise<AddAdminResult> => {
      if (museumId === null) return { ok: false, message: 'No museum is selected.' }
      if (!isLiveApi) return { ok: false, message: 'No API is configured.' }

      try {
        await api.addMuseumAdmin(museumId, { email: email.trim().toLowerCase(), password })
        // Re-read rather than splicing: the row carries server-set timestamps.
        setReloadToken((token) => token + 1)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          message: isApiError(error) ? error.message : 'Could not add that administrator.',
        }
      }
    },
    [museumId],
  )

  return useMemo(
    () => ({ admins, isLive: live, status, loadError, reload, addAdmin }),
    [addAdmin, admins, live, loadError, reload, status],
  )
}
