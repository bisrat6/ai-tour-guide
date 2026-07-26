/**
 * The signed-in session, reachable from anywhere.
 *
 * This lives outside App.tsx because the stores and pages need the session and
 * App.tsx imports them — reading it from there would be a cycle. App.tsx owns
 * the provider; this owns the shape and the hooks.
 */

import { createContext, useContext } from 'react'

export type Role = 'MUSEUM_ADMIN' | 'SYSTEM_ADMIN'

export type Session = {
  readonly email: string
  readonly role: Role
  /** Null for a system admin, who belongs to no museum. */
  readonly museumId: string | null
  /** Null in demo mode, when no API base URL is configured. */
  readonly token: string | null
  readonly expiresAt: string | null
}

export type SignInInput = {
  readonly email: string
  readonly password: string
  readonly role: Role
}

/**
 * `credentials` covers anything that must stay indistinguishable — a wrong
 * password, an unknown email, or the right account at the wrong door. `service`
 * is a problem with the connection itself, which is safe to describe plainly.
 */
export type SignInFailure = {
  readonly ok: false
  readonly kind: 'credentials' | 'service'
  readonly message: string
}

export type AuthContextValue = {
  readonly session: Session | null
  readonly signIn: (input: SignInInput) => Promise<{ ok: true } | SignInFailure>
  readonly signOut: () => void
}

export const authContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(authContext)
  if (context === null) {
    throw new Error('Auth context is unavailable.')
  }
  return context
}

/** True once the token is past its stated expiry. */
export function hasExpired(expiresAt: string | null): boolean {
  if (expiresAt === null) return false
  const at = new Date(expiresAt).getTime()
  return Number.isFinite(at) && at <= Date.now()
}
