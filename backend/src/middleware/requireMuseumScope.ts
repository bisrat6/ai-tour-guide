import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import type { AdminContext } from '../types/express.js';

/**
 * §8.4 — "the one piece of security that actually matters for the
 * product's core promise." The caller must have already loaded the
 * *actual* museumId of the resource being acted on, straight from the
 * database — never resolve it from the request body or query string, or a
 * museum admin could simply claim a different museumId and bypass this.
 *
 * A missing resource (null) throws 404; a resource that exists but belongs
 * to another museum throws 403. That is a deliberate, accepted trade that
 * confirms cross-tenant existence, appropriate for a small set of known,
 * contractually-bound museum operators.
 *
 * Exported directly (not just via the requireMuseumScope middleware below)
 * for routes like items' GET/POST where the scoped resource — a Room — is
 * resolved from a query/body field *after* request-body validation, so the
 * check can't run as an early middleware the way it does for `/:id` routes.
 */
export function assertMuseumScope(admin: AdminContext, resolvedMuseumId: string | null): void {
  if (resolvedMuseumId === null) {
    throw ApiError.notFound();
  }
  if (admin.role === 'SYSTEM_ADMIN') {
    return;
  }
  if (admin.museumId !== resolvedMuseumId) {
    throw ApiError.crossTenant();
  }
}

/** Middleware form for `/:id` routes, where the resource is resolvable from req.params alone. */
export function requireMuseumScope(resolveMuseumId: (req: Request) => Promise<string | null>) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.admin) {
        throw ApiError.unauthenticated();
      }
      const resolvedMuseumId = await resolveMuseumId(req);
      assertMuseumScope(req.admin, resolvedMuseumId);
      next();
    } catch (err) {
      next(err);
    }
  };
}
