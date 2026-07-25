import { ErrorCode, type ErrorCodeValue } from '../shared/errorEnvelope.js';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

/**
 * Every route throws this (directly or via a helper below) instead of
 * building a response by hand. errorHandler.ts is the only place that
 * turns it into the §7.1 envelope, so the shape can't drift route by route.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: ErrorCodeValue, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(details: ApiErrorDetail[], message = 'Request failed validation.'): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = 'Missing, invalid, or expired token.'): ApiError {
    return new ApiError(401, ErrorCode.UNAUTHENTICATED, message);
  }

  static invalidCredentials(message = 'Invalid credentials.'): ApiError {
    return new ApiError(401, ErrorCode.INVALID_CREDENTIALS, message);
  }

  static forbidden(message = 'Insufficient role.'): ApiError {
    return new ApiError(403, ErrorCode.FORBIDDEN, message);
  }

  static crossTenant(message = 'This resource belongs to another museum.'): ApiError {
    return new ApiError(403, ErrorCode.CROSS_TENANT_ACCESS, message);
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError(404, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message = 'Conflict.'): ApiError {
    return new ApiError(409, ErrorCode.CONFLICT, message);
  }

  static roomReferenced(message = 'Other rooms reference this room.'): ApiError {
    return new ApiError(409, ErrorCode.ROOM_REFERENCED, message);
  }

  static invalidRoomSequence(message = 'Invalid room sequence.'): ApiError {
    return new ApiError(422, ErrorCode.INVALID_ROOM_SEQUENCE, message);
  }

  static rateLimited(message = 'Too many requests.'): ApiError {
    return new ApiError(429, ErrorCode.RATE_LIMITED, message);
  }

  static internal(message = 'Unexpected error.'): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_ERROR, message);
  }

  static upstreamFailure(message = 'Upstream call failed.'): ApiError {
    return new ApiError(502, ErrorCode.UPSTREAM_FAILURE, message);
  }

  static upstreamUnavailable(message = 'Upstream is temporarily unavailable.'): ApiError {
    return new ApiError(503, ErrorCode.UPSTREAM_UNAVAILABLE, message);
  }

  // --- Billing and ticketing (dev3 §12) ---------------------------------

  /**
   * The limit is reported in `details` so a client can render "3 of 3 rooms
   * used" without re-deriving the numbers from the message string.
   */
  static tierLimitExceeded(info: {
    limit: string;
    tier: string;
    allowed: number | null;
    current: number;
  }): ApiError {
    const allowed = info.allowed ?? 'unlimited';
    return new ApiError(
      403,
      ErrorCode.TIER_LIMIT_EXCEEDED,
      `The ${info.tier} plan allows ${allowed} ${info.limit}. Upgrade to add more.`,
      [
        { path: 'limit', message: info.limit },
        { path: 'tier', message: info.tier },
        { path: 'allowed', message: String(allowed) },
        { path: 'current', message: String(info.current) },
      ],
    );
  }

  static subscriptionInactive(
    message = 'Your subscription is not active. Please renew to add new content.',
  ): ApiError {
    return new ApiError(403, ErrorCode.SUBSCRIPTION_INACTIVE, message);
  }

  static paymentAlreadyPending(
    message = 'A checkout for this tier is already in progress.',
  ): ApiError {
    return new ApiError(409, ErrorCode.PAYMENT_ALREADY_PENDING, message);
  }

  static paymentNotFound(message = 'Payment not found.'): ApiError {
    return new ApiError(404, ErrorCode.PAYMENT_NOT_FOUND, message);
  }

  static ticketUrlInvalid(reason: string): ApiError {
    return new ApiError(
      422,
      ErrorCode.TICKET_URL_INVALID,
      `Ticket validation URL is invalid: ${reason}`,
    );
  }
}
