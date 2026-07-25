import { PrismaClient, type SubscriptionTier, type SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const prisma = new PrismaClient();

export async function resetDb() {
  // TRUNCATE CASCADE clears FK graphs. Ignore tables that were dropped.
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'Payment','AdminAuditLog','ChatAnswer','Item','Room',
            'AudioAsset','AdminUser','Museum','TierPricing','PaymentWebhookEvent'
          )
      ) LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  for (const [tier, amount, name] of [
    ['BASIC', 1500, 'Basic'],
    ['PRO', 4500, 'Pro'],
    ['ENTERPRISE', 12000, 'Enterprise'],
  ] as const) {
    await prisma.tierPricing.create({
      data: {
        tier,
        amountEtb: amount,
        periodDays: 30,
        displayName: name,
        active: true,
      },
    });
  }
}

export interface TestMuseum {
  id: string;
  slug: string;
  tier: SubscriptionTier;
  adminId: string;
  adminEmail: string;
  roomIds: string[];
}

async function createRooms(museumId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const room = await prisma.room.create({
      data: {
        museumId,
        legacyId: `room_${i}`,
        storyOrder: i,
        title: `Room ${i}`,
        roomOverviewText: `Overview ${i}`,
        narrationScript: `Narration ${i}`,
      },
    });
    ids.push(room.id);
  }
  return ids;
}

export async function seedMuseum(opts: {
  slug: string;
  name: string;
  tier: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionRenewsAt?: Date | null;
  roomCount: number;
  ticketValidationUrl?: string | null;
  status?: 'ACTIVE' | 'SUSPENDED';
  adminEmail?: string;
}): Promise<TestMuseum> {
  const museum = await prisma.museum.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      tier: opts.tier,
      subscriptionStatus: opts.subscriptionStatus ?? 'ACTIVE',
      subscriptionRenewsAt: opts.subscriptionRenewsAt ?? null,
      ticketValidationUrl: opts.ticketValidationUrl ?? null,
      status: opts.status ?? 'ACTIVE',
      billingEmail: `${opts.slug}@billing.test`,
    },
  });

  const adminEmail = opts.adminEmail ?? `admin@${opts.slug}.test`;
  const admin = await prisma.adminUser.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash('Admin1234!', 4),
      role: 'MUSEUM_ADMIN',
      museumId: museum.id,
    },
  });

  const roomIds = await createRooms(museum.id, opts.roomCount);

  return {
    id: museum.id,
    slug: museum.slug,
    tier: museum.tier,
    adminId: admin.id,
    adminEmail,
    roomIds,
  };
}

export async function seedSystemAdmin(email = 'system@test.local') {
  return prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('Admin1234!', 4),
      role: 'SYSTEM_ADMIN',
      museumId: null,
    },
  });
}
