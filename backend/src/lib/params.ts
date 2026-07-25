import type { Request } from 'express';
import { ApiError } from './errors.js';

/**
 * A route registered as `/:name` guarantees Express populates `req.params`
 * with that key by the time a handler runs. `noUncheckedIndexedAccess`
 * doesn't know that, so every route with path params reads them through
 * here once instead of sprinkling non-null assertions.
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) {
    throw ApiError.notFound();
  }
  return value;
}
