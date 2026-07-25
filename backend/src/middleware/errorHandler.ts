import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, ApiErrorDetail } from '../lib/errors';
import { logger } from '../lib/logger';

/** Terminal error handler — the single place that owns the response envelope (§7.1). */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: { message: 'Request validation failed', code: 'VALIDATION_ERROR', requestId, details },
    });
    return;
  }

  if (err instanceof ApiError) {
    const body: Record<string, unknown> = {
      message: err.message,
      code: err.code,
      requestId,
    };
    if (err.code === 'VALIDATION_ERROR') {
      body.details = err.details ?? [];
    }
    res.status(err.statusCode).json({ error: body });
    return;
  }

  logger.error({ requestId, err }, 'unhandled error');
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR', requestId },
  });
}
