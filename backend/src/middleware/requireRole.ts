import type { AdminRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';

/** §8.3. Must run after requireAuth — reads req.admin, doesn't verify the token. */
export function requireRole(role: AdminRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.admin?.role !== role) {
      next(ApiError.forbidden());
      return;
    }
    next();
  };
}
