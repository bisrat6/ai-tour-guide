import bcrypt from 'bcrypt';
import { ApiError } from '../../lib/errors.js';
import { signAuthToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import { isLockedOut, recordLoginFailure, recordLoginSuccess } from './loginAttempts.js';
import type { LoginRequest, LoginResponse } from './schemas.js';

// Precomputed once (not per-request) so an unknown-email attempt still pays
// the same bcrypt cost as a real comparison against a stored hash — §8.1
// requires response timing not to leak whether an account exists.
const DUMMY_PASSWORD_HASH = await bcrypt.hash('not-a-real-account-password', 12);

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const email = input.email.trim().toLowerCase();

  if (isLockedOut(email)) {
    throw ApiError.rateLimited(
      'Too many failed login attempts for this account. Try again in 15 minutes.',
    );
  }

  const user = await prisma.adminUser.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  // §8.1: "email not found" and "wrong password" must be indistinguishable
  // in both body and timing, so both fall through to the same generic error.
  if (!user || !passwordMatches) {
    recordLoginFailure(email);
    throw ApiError.invalidCredentials();
  }

  recordLoginSuccess(email);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { token, expiresAt } = signAuthToken({
    sub: user.id,
    role: user.role,
    museumId: user.museumId,
  });

  return {
    token,
    role: user.role,
    museumId: user.museumId,
    expiresAt: expiresAt.toISOString(),
  };
}
