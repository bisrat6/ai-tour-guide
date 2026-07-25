import { signAuthToken } from '../../src/lib/jwt.js';
import { seedAdmin, seedMuseum } from './db.js';

/**
 * Shared setup for the §17.2 isolation matrix (isolation.test.ts) — every
 * case needs at least a system admin plus a tenant admin, so this is pulled
 * out once instead of re-derived per case.
 */
export const ISOLATION_PASSWORD = 'correct-horse-battery-staple';

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function seedTenantAdmin(opts: { name: string; slug: string; email: string }) {
  const museum = await seedMuseum({ name: opts.name, slug: opts.slug });
  const admin = await seedAdmin({
    email: opts.email,
    password: ISOLATION_PASSWORD,
    role: 'MUSEUM_ADMIN',
    museumId: museum.id,
  });
  const token = signAuthToken({ sub: admin.id, role: 'MUSEUM_ADMIN', museumId: museum.id }).token;
  return { museum, admin, token };
}

export async function seedSystemAdmin() {
  const admin = await seedAdmin({
    email: 'system@example.com',
    password: ISOLATION_PASSWORD,
    role: 'SYSTEM_ADMIN',
  });
  const token = signAuthToken({ sub: admin.id, role: 'SYSTEM_ADMIN', museumId: null }).token;
  return { admin, token };
}
