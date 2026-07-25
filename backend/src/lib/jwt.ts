import type { AdminRole } from '@prisma/client';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * §8.1/§8.2. The token is stateless — no session store — so `sub`, `role`,
 * and `museumId` are exactly what requireAuth/requireRole/requireMuseumScope
 * need without a database round trip on every request.
 */
export interface AuthTokenPayload {
  sub: string;
  role: AdminRole;
  museumId: string | null;
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

export function signAuthToken(payload: AuthTokenPayload): SignedToken {
  const token = jwt.sign(payload, env.JWT_SECRET, {
    // Validated against a duration-string pattern in config/env.ts; jsonwebtoken's
    // own type is narrower (a template-literal union) than plain `string`.
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
    throw new Error('Failed to determine expiry of newly signed token.');
  }
  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

/**
 * Throws jsonwebtoken's own errors (TokenExpiredError, JsonWebTokenError,
 * etc.) on any failure — requireAuth.ts is the only place that decides how
 * that becomes a 401, so verification itself stays simple.
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new jwt.JsonWebTokenError('Unexpected token payload shape.');
  }
  return decoded as AuthTokenPayload;
}
