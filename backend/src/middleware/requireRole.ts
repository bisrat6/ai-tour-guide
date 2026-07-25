import type { Request, Response, NextFunction } from 'express';
import type { AdminRole } from '@prisma/client';
import { ApiError } from '../lib/errors.js';

export function requireRole(role: AdminRole) {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (req.admin?.role !== role) {
      return next(ApiError.forbidden(`This action requires the ${role} role`));
    }
    next();
  };
}
