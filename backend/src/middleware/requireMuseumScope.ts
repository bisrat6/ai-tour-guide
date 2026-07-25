import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';

/**
 * §8.4 — "the one piece of security that actually matters for the
 * product's core promise." Must run after requireAuth.
 *
 * Takes a resolver that loads the *actual* museumId of the resource being
 * acted on, straight from the database. Never resolve it from the request
 * body or query string — a museum admin would then simply claim a
 * different museumId in their request and bypass the check entirely.
 *
 * Corollary (also §8.4): a missing resource returns 404; a resource that
 * exists but belongs to another museum returns 403. That is a deliberate,
 * accepted trade that confirms cross-tenant existence, appropriate for a
 * small set of known, contractually-bound museum operators.
 */
export function requireMuseumScope(resolveMuseumId: (req: Request) => Promise<string | null>) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.admin) {
        throw ApiError.unauthenticated();
      }

      const resolvedMuseumId = await resolveMuseumId(req);
      if (resolvedMuseumId === null) {
        throw ApiError.notFound();
      }

      if (req.admin.role === 'SYSTEM_ADMIN') {
        next();
        return;
      }

      if (req.admin.museumId !== resolvedMuseumId) {
        throw ApiError.crossTenant();
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
