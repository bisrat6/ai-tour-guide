/**
 * Where the admin API lives.
 *
 * Deliberately the only place a host appears. Netlify sets VITE_API_BASE_URL per
 * deploy context, which is what lets the same build point at the Render service,
 * a preview backend, or a local server without a code change.
 *
 * When it is unset the console runs in demo mode on fixtures. That keeps the app
 * runnable for design and review work while the backend lives in a separate
 * repository, and it is surfaced in the UI rather than being silent — nobody
 * should mistake fixture data for live data.
 */

function normalise(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

export const apiBaseUrl: string | null = normalise(import.meta.env.VITE_API_BASE_URL)

/** True once a real API is configured. False means fixtures. */
export const isLiveApi: boolean = apiBaseUrl !== null

/**
 * Render free-tier services sleep, and a cold start can take the best part of a
 * minute. A short timeout would turn a normal first request into a failure.
 */
export const requestTimeoutMs = 60_000
