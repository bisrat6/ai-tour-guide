import jwt from 'jsonwebtoken';
import type { AdminRole } from '@prisma/client';

export function mintToken(opts: {
  id: string;
  role: AdminRole;
  museumId: string | null;
}): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET missing in test env');

  return jwt.sign(
    { sub: opts.id, role: opts.role, museumId: opts.museumId },
    secret,
    { expiresIn: '1h' },
  );
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
