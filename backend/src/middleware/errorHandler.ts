import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError, ErrorCode } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  // ── Zod validation error ────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: {
        message: 'Validation error',
        code: ErrorCode.VALIDATION_ERROR,
        requestId,
        details,
      },
    });
    return;
  }

  // ── Known ApiError ──────────────────────────────────────────────────────────
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ requestId, err }, err.message);
    } else {
      logger.warn({ requestId, code: err.code }, err.message);
    }
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        requestId,
        ...(err.details.length > 0 ? { details: err.details } : {}),
      },
    });
    return;
  }

  // ── Unknown / unexpected error ──────────────────────────────────────────────
  logger.error({ requestId, err }, 'Unexpected error');
  res.status(500).json({
    error: {
      message: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
      requestId,
    },
  });
}
