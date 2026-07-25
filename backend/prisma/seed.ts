import { PrismaClient, SubscriptionTier } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Placeholder ETB prices — update when Q1 (real prices) is resolved
const TIER_PRICES: Record<SubscriptionTier, { amountEtb: number; displayName: string; description: string }> = {
  BASIC: {
    amountEtb: 1500,
    displayName: 'Basic',
    description: '1 floor, standard features, basic analytics',
  },
  PRO: {
    amountEtb: 4500,
    displayName: 'Pro',
    description: 'Up to 3 floors, custom branding, advanced analytics',
  },
  ENTERPRISE: {
    amountEtb: 12000,
    displayName: 'Enterprise',
    description: 'Unlimited floors, white-label delivery, deep analytics',
  },
};

async function main() {
  console.log('[seed] Starting...');

  // ── TierPricing ─────────────────────────────────────────────────────────────
  for (const [tier, pricing] of Object.entries(TIER_PRICES) as [SubscriptionTier, typeof TIER_PRICES[SubscriptionTier]][]) {
    await prisma.tierPricing.upsert({
      where: { tier },
      create: {
        tier,
        amountEtb: pricing.amountEtb,
        periodDays: 30,
        displayName: pricing.displayName,
        description: pricing.description,
        active: true,
      },
      update: {
        amountEtb: pricing.amountEtb,
        displayName: pricing.displayName,
        description: pricing.description,
      },
    });
  }
  console.log('[seed] TierPricing upserted');

  // ── System admin ────────────────────────────────────────────────────────────
  const systemEmail = process.env['SEED_SYSTEM_ADMIN_EMAIL'] ?? 'system@adwa.local';
  const systemPassword = process.env['SEED_SYSTEM_ADMIN_PASSWORD'] ?? 'Admin1234!';
  const systemHash = await bcrypt.hash(systemPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: systemEmail },
    create: {
      email: systemEmail,
      passwordHash: systemHash,
      role: 'SYSTEM_ADMIN',
      museumId: null,
    },
    update: {},
  });
  console.log(`[seed] System admin: ${systemEmail}`);

  // ── Museums + museum admins ──────────────────────────────────────────────────
  const museums = [
    {
      slug: 'adwa',
      name: 'Adwa Victory Museum',
      tier: 'BASIC' as SubscriptionTier,
      adminEmail: 'admin@adwa.local',
      // BASIC has 1 room limit — seed exactly 1 room so tier-limit tests start at cap
      rooms: [
        {
          legacyId: 'room_1',
          storyOrder: 1,
          title: 'The Road to Adwa',
          roomOverviewText: 'Overview of the events leading to the Battle of Adwa.',
          narrationScript: 'Welcome to the Road to Adwa gallery.',
          items: [
            {
              legacyId: 'room_1_treaty',
              name: 'Treaty of Wuchale',
              shortDescription: 'The treaty signed between Ethiopia and Italy.',
              detailText:
                'The Treaty of Wuchale was signed on 2 May 1889. The Amharic and Italian texts differed materially: the Italian version implied a protectorate. Emperor Menelik II rejected the Italian interpretation in 1893.',
              displayOrder: 0,
            },
            {
              legacyId: 'room_1_map',
              name: 'Pre-war Map',
              shortDescription: 'Map showing the military positions before the battle.',
              detailText:
                'The map documents the positions of Ethiopian and Italian forces as they converged on Adwa in late February 1896.',
              displayOrder: 1,
            },
          ],
        },
      ],
    },
    {
      slug: 'louvre',
      name: 'Louvre Museum (Demo)',
      tier: 'PRO' as SubscriptionTier,
      adminEmail: 'admin@louvre.local',
      // PRO has 3 room limit — seed 3 rooms so tier-limit tests start at cap
      rooms: [
        {
          legacyId: 'room_1',
          storyOrder: 1,
          title: 'Mesopotamia',
          roomOverviewText: 'Ancient civilisations of Mesopotamia.',
          narrationScript: 'Welcome to the Mesopotamia gallery.',
          items: [
            {
              legacyId: 'louvre_1_hammurabi',
              name: "Code of Hammurabi",
              shortDescription: "One of the earliest legal codes.",
              detailText: "The Code of Hammurabi, inscribed on a basalt stele, dates to around 1754 BC.",
              displayOrder: 0,
            },
          ],
        },
        {
          legacyId: 'room_2',
          storyOrder: 2,
          title: 'Ancient Egypt',
          roomOverviewText: 'Egyptian artefacts from the Old Kingdom to the Late Period.',
          narrationScript: 'Welcome to the Ancient Egypt gallery.',
          items: [],
        },
        {
          legacyId: 'room_3',
          storyOrder: 3,
          title: 'Greek Antiquities',
          roomOverviewText: 'Sculptures and vases from ancient Greece.',
          narrationScript: 'Welcome to the Greek Antiquities gallery.',
          items: [],
        },
      ],
    },
  ] as const;

  for (const m of museums) {
    const museum = await prisma.museum.upsert({
      where: { slug: m.slug },
      create: {
        name: m.name,
        slug: m.slug,
        tier: m.tier,
        subscriptionStatus: 'ACTIVE',
      },
      update: { name: m.name },
    });

    // Museum admin
    const adminHash = await bcrypt.hash('Admin1234!', 12);
    await prisma.adminUser.upsert({
      where: { email: m.adminEmail },
      create: {
        email: m.adminEmail,
        passwordHash: adminHash,
        role: 'MUSEUM_ADMIN',
        museumId: museum.id,
      },
      update: {},
    });
    console.log(`[seed] Museum "${m.slug}" + admin "${m.adminEmail}"`);

    // Rooms (two-pass: create first, then link nextRoomId)
    const roomIdByLegacy = new Map<string, string>();
    for (const r of m.rooms) {
      const room = await prisma.room.upsert({
        where: { museumId_legacyId: { museumId: museum.id, legacyId: r.legacyId } },
        create: {
          legacyId: r.legacyId,
          museumId: museum.id,
          storyOrder: r.storyOrder,
          title: r.title,
          roomOverviewText: r.roomOverviewText,
          narrationScript: r.narrationScript,
        },
        update: { title: r.title, roomOverviewText: r.roomOverviewText },
      });
      roomIdByLegacy.set(r.legacyId, room.id);

      for (const item of r.items) {
        await prisma.item.upsert({
          where: { roomId_legacyId: { roomId: room.id, legacyId: item.legacyId } },
          create: {
            legacyId: item.legacyId,
            roomId: room.id,
            name: item.name,
            shortDescription: item.shortDescription,
            detailText: item.detailText,
            displayOrder: item.displayOrder,
          },
          update: { name: item.name },
        });
      }
    }

    // Second pass: link nextRoomId in storyOrder sequence
    const sortedRooms = [...m.rooms].sort((a, b) => a.storyOrder - b.storyOrder);
    for (let i = 0; i < sortedRooms.length - 1; i++) {
      const current = sortedRooms[i];
      const next = sortedRooms[i + 1];
      if (!current || !next) continue;
      const currentId = roomIdByLegacy.get(current.legacyId);
      const nextId = roomIdByLegacy.get(next.legacyId);
      if (currentId && nextId) {
        await prisma.room.update({ where: { id: currentId }, data: { nextRoomId: nextId } });
      }
    }
  }

  console.log('[seed] Done');
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
