import { apiBaseUrl, requestTimeoutMs } from './config.ts'
import { ApiError, type ApiErrorCode, type ApiErrorDetail } from './errors.ts'

/**
 * The bearer token is held here rather than threaded through every call site.
 * The auth provider owns it and pushes changes in; nothing else should write it.
 */
let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export type QueryValue = string | number | boolean | undefined | null

export type RequestOptions = {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  readonly body?: unknown
  readonly query?: Readonly<Record<string, QueryValue>>
  /** Overrides the stored token. Used by sign-in, which has no session yet. */
  readonly token?: string | null
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

const STATUS_FALLBACK: Readonly<Record<number, ApiErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'INVALID_ROOM_SEQUENCE',
  429: 'RATE_LIMITED',
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  if (apiBaseUrl === null) {
    throw new ApiError({
      message: 'No API base URL is configured. Set VITE_API_BASE_URL to use live data.',
      code: 'NETWORK_ERROR',
      status: 0,
    })
  }

  const url = new URL(`${apiBaseUrl}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function readEnvelope(payload: unknown): {
  message?: string
  code?: string
  requestId?: string
  details?: readonly ApiErrorDetail[]
} {
  if (typeof payload !== 'object' || payload === null) return {}
  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return {}
  return error as { message?: string; code?: string; requestId?: string; details?: ApiErrorDetail[] }
}

async function toApiError(response: Response): Promise<ApiError> {
  const headerRequestId = response.headers.get('X-Request-Id')

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const envelope = readEnvelope(payload)
  const code = (envelope.code ?? STATUS_FALLBACK[response.status] ?? 'UNKNOWN') as ApiErrorCode

  return new ApiError({
    message: envelope.message ?? `Request failed with status ${response.status}.`,
    code,
    status: response.status,
    requestId: envelope.requestId ?? headerRequestId,
    details: envelope.details ?? [],
  })
}

/**
 * One request. Returns the parsed body, or undefined for a 204.
 *
 * Every failure leaves here as an ApiError, including transport failures, so no
 * caller has to tell a network problem from an HTTP one.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, token, signal, timeoutMs = requestTimeoutMs } = options

  const url = buildUrl(path, query)
  const headers: Record<string, string> = { Accept: 'application/json' }

  const bearer = token === undefined ? authToken : token
  if (bearer !== null && bearer !== undefined) headers.Authorization = `Bearer ${bearer}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  if (signal !== undefined) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const init: RequestInit = {
    method,
    headers,
    signal: controller.signal,
    // The API authenticates with a bearer header, so no cookies cross origins.
    credentials: 'omit',
    mode: 'cors',
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    const aborted = controller.signal.aborted
    throw new ApiError({
      message: aborted
        ? 'The request timed out.'
        : 'Could not reach the server. This is often CORS or an unreachable host.',
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      status: 0,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T

  try {
    return (await response.json()) as T
  } catch {
    return undefined as T
  }
}
