// ── Error codes ───────────────────────────────────────────────────────────────
// v2 §7.2 codes + dev3 §12 additions.
// The terminal errorHandler in middleware/errorHandler.ts owns the response
// shape; nothing else writes non-2xx bodies.

export const ErrorCode = {
  // v2 §7.2
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  CROSS_TENANT_ACCESS: 'CROSS_TENANT_ACCESS',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ROOM_REFERENCED: 'ROOM_REFERENCED',
  INVALID_ROOM_SEQUENCE: 'INVALID_ROOM_SEQUENCE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',

  // dev3 §12
  TIER_LIMIT_EXCEEDED: 'TIER_LIMIT_EXCEEDED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  PAYMENT_ALREADY_PENDING: 'PAYMENT_ALREADY_PENDING',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  TICKET_URL_INVALID: 'TICKET_URL_INVALID',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, ErrorCode.UNAUTHENTICATED, message);
  }

  static invalidCredentials() {
    return new ApiError(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  static forbidden(message = 'Access denied') {
    return new ApiError(403, ErrorCode.FORBIDDEN, message);
  }

  static crossTenantAccess() {
    return new ApiError(403, ErrorCode.CROSS_TENANT_ACCESS, 'Resource belongs to another museum');
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string) {
    return new ApiError(409, ErrorCode.CONFLICT, message);
  }

  static upstreamFailure(message = 'An upstream service failed') {
    return new ApiError(502, ErrorCode.UPSTREAM_FAILURE, message);
  }

  static upstreamUnavailable(vendor: string) {
    return new ApiError(503, ErrorCode.UPSTREAM_UNAVAILABLE, `${vendor} is temporarily unavailable`);
  }

  static tierLimitExceeded(
    details: { limit: string; tier: string; allowed: number | null; current: number },
  ) {
    const allowed = details.allowed ?? '∞';
    return new ApiError(
      403,
      ErrorCode.TIER_LIMIT_EXCEEDED,
      `The ${details.tier} plan allows ${allowed} ${details.limit}. Upgrade to add more.`,
      [{ ...details, message: 'Tier limit reached' }],
    );
  }

  static subscriptionInactive() {
    return new ApiError(
      403,
      ErrorCode.SUBSCRIPTION_INACTIVE,
      'Your subscription is not active. Please renew to add new content.',
    );
  }

  static ticketUrlInvalid(reason: string) {
    return new ApiError(422, ErrorCode.TICKET_URL_INVALID, `Ticket validation URL is invalid: ${reason}`);
  }
}
