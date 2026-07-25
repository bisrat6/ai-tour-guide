import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../lib/errors.js';
import { verifyAuthToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

/**
 * §8.2. Runs on every /admin/* route. Not wrapped in asyncHandler —
 * unlike a route, this needs its own try/catch so it stays directly
 * callable (and awaitable) in tests without the fire-and-forget wrapper.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthenticated();
    }
    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthenticated();
      }
      throw err;
    }

    // §8.2 (M3): a suspended museum's admin loses access immediately, not
    // whenever their 12-hour token happens to expire on its own.
    if (payload.museumId) {
      const museum = await prisma.museum.findUnique({
        where: { id: payload.museumId },
        select: { status: true },
      });
      if (!museum || museum.status === 'SUSPENDED') {
        throw ApiError.forbidden('This museum has been suspended.');
      }
    }

    req.admin = { id: payload.sub, role: payload.role, museumId: payload.museumId };
    next();
  } catch (err) {
    next(err);
  }
}
