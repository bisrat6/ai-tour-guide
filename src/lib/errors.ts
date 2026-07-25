export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'CROSS_TENANT_ACCESS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ROOM_REFERENCED'
  | 'INVALID_ROOM_SEQUENCE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_FAILURE'
  | 'UPSTREAM_UNAVAILABLE';

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  CROSS_TENANT_ACCESS: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ROOM_REFERENCED: 409,
  INVALID_ROOM_SEQUENCE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_FAILURE: 502,
  UPSTREAM_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static validation(message: string, details?: ApiErrorDetail[]) {
    return new ApiError('VALIDATION_ERROR', message, details);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError('NOT_FOUND', message);
  }

  static crossTenant(message = 'This resource belongs to a different museum') {
    return new ApiError('CROSS_TENANT_ACCESS', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError('FORBIDDEN', message);
  }

  static conflict(message: string) {
    return new ApiError('CONFLICT', message);
  }

  static upstreamFailure(message = 'A third-party service call failed') {
    return new ApiError('UPSTREAM_FAILURE', message);
  }

  static upstreamUnavailable(message = 'A third-party service is temporarily unavailable') {
    return new ApiError('UPSTREAM_UNAVAILABLE', message);
  }

  static rateLimited(message = 'Too many requests') {
    return new ApiError('RATE_LIMITED', message);
  }
}
