/**
 * The error vocabulary the API returns, plus the two failures that happen before
 * a response exists.
 *
 * FORBIDDEN and CROSS_TENANT_ACCESS are kept apart on purpose. The first is a
 * role or field rule — a museum admin touching its own `status`. The second is a
 * tenant boundary — museum A reaching museum B. They read the same to a careless
 * client and mean very different things to a user.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CROSS_TENANT_ACCESS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ROOM_REFERENCED'
  | 'INVALID_ROOM_SEQUENCE'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'

export type ApiErrorDetail = {
  readonly field?: string
  readonly message?: string
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  /**
   * Present on any response that reached the server. The API generates it so a
   * report can be traced to a log line, so show it in error UI.
   */
  readonly requestId: string | null
  readonly details: readonly ApiErrorDetail[]

  constructor(init: {
    message: string
    code: ApiErrorCode
    status: number
    requestId?: string | null
    details?: readonly ApiErrorDetail[]
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.requestId = init.requestId ?? null
    this.details = init.details ?? []
  }

  /** The message for a named form field, when the server said which one failed. */
  fieldError(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/**
 * Whether the caller's session is over. Both codes mean the stored token can no
 * longer be used, so the app should return to the door rather than retry.
 */
export function isSessionExpired(error: unknown): boolean {
  return isApiError(error) && error.code === 'UNAUTHENTICATED'
}

/** Copy for the cases a user can act on. Anything else falls back to the server message. */
export function messageForCode(error: ApiError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Could not reach the server. Check your connection and try again.'
    case 'TIMEOUT':
      return 'The server took too long to respond. It may be waking up — try again in a moment.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a few minutes before trying again.'
    case 'CROSS_TENANT_ACCESS':
      return 'That content belongs to a different museum.'
    case 'FORBIDDEN':
      return 'Your role does not allow that change.'
    case 'ROOM_REFERENCED':
      return 'Another room points at this one. Remove the link or delete it anyway.'
    case 'INVALID_ROOM_SEQUENCE':
      return 'That next-room link would break the room sequence.'
    default:
      return error.message
  }
}
