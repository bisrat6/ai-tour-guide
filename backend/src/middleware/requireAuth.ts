import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import type { AdminRole } from '@prisma/client';

// ── Type extension ───────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin: AdminPayload;
    }
  }
}

export interface AdminPayload {
  id: string;
  role: AdminRole;
  museumId: string | null;
}

interface JwtAdminClaims {
  sub: string;
  role: AdminRole;
  museumId: string | null;
}

// ── DEV STUB ─────────────────────────────────────────────────────────────────
// This file is a stub owned by Dev 1. It accepts JWTs signed with JWT_SECRET
// and performs the suspended-museum check from v2 §8.2.
// Dev 1 replaces the token verification with full bcrypt + real flow;
// the req.admin shape and the suspended-museum check stay identical.
// ─────────────────────────────────────────────────────────────────────────────

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return next(ApiError.unauthenticated());
    }

    const token = authHeader.slice(7);
    const secret = process.env['JWT_SECRET'];
    if (!secret) return next(ApiError.unauthenticated('Server misconfigured'));

    let claims: JwtAdminClaims;
    try {
      claims = jwt.verify(token, secret) as JwtAdminClaims;
    } catch {
      return next(ApiError.unauthenticated('Token is invalid or expired'));
    }

    // Suspended-museum check (v2 §8.2 / M3)
    if (claims.museumId) {
      const museum = await prisma.museum.findUnique({ where: { id: claims.museumId } });
      if (!museum) return next(ApiError.unauthenticated('Museum not found'));
      if (museum.status === 'SUSPENDED') {
        return next(ApiError.forbidden('Your museum account is suspended'));
      }
    }

    req.admin = { id: claims.sub, role: claims.role, museumId: claims.museumId };
    next();
  } catch (err) {
    next(err);
  }
}
