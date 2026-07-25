import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';
import { ErrorCode } from '../shared/errorEnvelope.js';

function isBodyParserError(err: unknown): err is Error & { type: string } {
  return (
    err instanceof Error &&
    'type' in err &&
    typeof err.type === 'string' &&
    (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
  );
}

/**
 * The single place that turns any thrown error into the §7.1 envelope.
 * Every route relies on this instead of building error responses by hand,
 * so the shape can never drift route by route. Must be the last
 * app.use() — Express recognizes it as an error handler by its 4 params.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      req.log.error({ err, code: err.code }, err.message);
    } else {
      req.log.warn({ code: err.code }, err.message);
    }
    res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code,
        requestId: req.requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    req.log.warn({ details }, 'Request failed validation.');
    res.status(400).json({
      error: {
        message: 'Request failed validation.',
        code: ErrorCode.VALIDATION_ERROR,
        requestId: req.requestId,
        details,
      },
    });
    return;
  }

  // body-parser (express.json) reports malformed/oversized/wrong-content-type
  // bodies as plain Errors carrying a `type` like 'entity.parse.failed' or
  // 'entity.too.large' — client input, not a server bug, so none of these
  // may fall through to the generic 500 below.
  if (isBodyParserError(err)) {
    req.log.warn({ err }, 'Malformed or oversized request body.');
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({
      error: {
        message:
          err.type === 'entity.too.large'
            ? 'Request body is too large.'
            : 'Request body is not valid JSON.',
        code: ErrorCode.VALIDATION_ERROR,
        requestId: req.requestId,
      },
    });
    return;
  }

  // P2002: unique constraint violation. Everything else falls through to
  // 500 — most other Prisma error codes indicate a bug, not bad input.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    req.log.warn({ err }, 'Unique constraint violation.');
    res.status(409).json({
      error: {
        message: 'A resource with these unique fields already exists.',
        code: ErrorCode.CONFLICT,
        requestId: req.requestId,
      },
    });
    return;
  }

  req.log.error({ err }, 'Unhandled error.');
  res.status(500).json({
    error: {
      message: 'An unexpected error occurred.',
      code: ErrorCode.INTERNAL_ERROR,
      requestId: req.requestId,
    },
  });
}
