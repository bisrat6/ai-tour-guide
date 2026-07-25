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
}
