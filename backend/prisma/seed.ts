/**
 * D1-1: seeds only the one SYSTEM_ADMIN account, from environment
 * variables — never hardcoded (§8.1: "There should only ever be a small,
 * known number"). Both museums' content lands in D1-2 (§16).
 */
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  if (!env.SEED_SYSTEM_ADMIN_EMAIL || !env.SEED_SYSTEM_ADMIN_PASSWORD) {
    throw new Error(
      'SEED_SYSTEM_ADMIN_EMAIL and SEED_SYSTEM_ADMIN_PASSWORD must both be set to seed the system admin.',
    );
  }

  const passwordHash = await bcrypt.hash(env.SEED_SYSTEM_ADMIN_PASSWORD, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email: env.SEED_SYSTEM_ADMIN_EMAIL },
    create: {
      email: env.SEED_SYSTEM_ADMIN_EMAIL,
      passwordHash,
      role: 'SYSTEM_ADMIN',
      museumId: null,
    },
    update: { passwordHash },
  });

  console.log(`Seeded SYSTEM_ADMIN: ${admin.email} (${admin.id})`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
