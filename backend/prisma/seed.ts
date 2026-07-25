/**
 * D1-1: seeds the one SYSTEM_ADMIN account from environment variables.
 * D1-2 (§16): loads both museums' real content — rooms, items, and personas
 * — from data/*.json and data/*.md, plus one MUSEUM_ADMIN per museum for
 * local development.
 *
 * Idempotent: matches on Museum.slug and legacyId, so re-running updates
 * existing rows instead of duplicating them. Two passes per museum — all
 * rooms and items first, then nextRoomId resolution — because a room's
 * "next" room may not exist yet on the first pass.
 */
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  extractSystemPrompt,
  loadWaypoints,
  MUSEUM_SEED_SPECS,
} from '../src/shared/museumSeedData.js';

async function seedSystemAdmin() {
  if (!env.SEED_SYSTEM_ADMIN_EMAIL || !env.SEED_SYSTEM_ADMIN_PASSWORD) {
    throw new Error(
      'SEED_SYSTEM_ADMIN_EMAIL and SEED_SYSTEM_ADMIN_PASSWORD must both be set to seed the system admin.',
    );
  }

  const passwordHash = await bcrypt.hash(env.SEED_SYSTEM_ADMIN_PASSWORD, 12);

  const email = env.SEED_SYSTEM_ADMIN_EMAIL.trim().toLowerCase();
  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: 'SYSTEM_ADMIN',
      museumId: null,
    },
    update: { passwordHash },
  });

  console.log(`Seeded SYSTEM_ADMIN: ${admin.email} (${admin.id})`);
}

/**
 * Prices for each tier (dev3 §4.1). Upserted rather than created so a price
 * edited in the database is not silently reverted by a re-seed — only the
 * catalogue copy is refreshed.
 */
async function seedTierPricing() {
  const tiers = [
    {
      tier: 'BASIC' as const,
      amountEtb: 1500,
      displayName: 'Basic',
      description: '1 floor, standard features, basic analytics',
    },
    {
      tier: 'PRO' as const,
      amountEtb: 4500,
      displayName: 'Pro',
      description: 'Up to 3 floors, custom branding, advanced analytics',
    },
    {
      tier: 'ENTERPRISE' as const,
      amountEtb: 12000,
      displayName: 'Enterprise',
      description: 'Unlimited floors, white-label delivery, deep analytics',
    },
  ];

  for (const { tier, amountEtb, displayName, description } of tiers) {
    await prisma.tierPricing.upsert({
      where: { tier },
      create: { tier, amountEtb, periodDays: 30, displayName, description, active: true },
      update: { displayName, description },
    });
  }

  console.log(`Seeded tier pricing: ${tiers.map((t) => t.tier).join(', ')}.`);
}

async function seedMuseums() {
  if (!env.SEED_MUSEUM_ADMIN_PASSWORD) {
    console.warn('SEED_MUSEUM_ADMIN_PASSWORD is not set — skipping museum content seeding.');
    return;
  }
  const museumAdminPasswordHash = await bcrypt.hash(env.SEED_MUSEUM_ADMIN_PASSWORD, 12);

  for (const spec of MUSEUM_SEED_SPECS) {
    const [systemPrompt, waypoints] = await Promise.all([
      extractSystemPrompt(spec.systemPromptFile),
      loadWaypoints(spec.waypointsFile),
    ]);

    await prisma.$transaction(async (tx) => {
      const museum = await tx.museum.upsert({
        where: { slug: spec.slug },
        create: { name: spec.name, slug: spec.slug, systemPrompt },
        update: { name: spec.name, systemPrompt },
      });

      const adminEmail = spec.adminEmail.trim().toLowerCase();
      await tx.adminUser.upsert({
        where: { email: adminEmail },
        create: {
          email: adminEmail,
          passwordHash: museumAdminPasswordHash,
          role: 'MUSEUM_ADMIN',
          museumId: museum.id,
        },
        update: { passwordHash: museumAdminPasswordHash, museumId: museum.id },
      });

      // Pass 1: upsert every room and its items, nextRoomId left untouched.
      const roomIdByLegacyId = new Map<string, string>();
      for (const wp of waypoints) {
        const room = await tx.room.upsert({
          where: { museumId_legacyId: { museumId: museum.id, legacyId: wp.id } },
          create: {
            museumId: museum.id,
            legacyId: wp.id,
            storyOrder: wp.story_order,
            title: wp.title,
            roomOverviewText: wp.room_overview_text,
            narrationScript: wp.room_narration_script,
          },
          update: {
            storyOrder: wp.story_order,
            title: wp.title,
            roomOverviewText: wp.room_overview_text,
            narrationScript: wp.room_narration_script,
          },
        });
        roomIdByLegacyId.set(wp.id, room.id);

        for (const [index, rawItem] of wp.items.entries()) {
          await tx.item.upsert({
            where: { roomId_legacyId: { roomId: room.id, legacyId: rawItem.id } },
            create: {
              roomId: room.id,
              legacyId: rawItem.id,
              name: rawItem.name,
              shortDescription: rawItem.short_description,
              detailText: rawItem.detail_text,
              imageUrl: rawItem.image_url,
              displayOrder: index,
            },
            update: {
              name: rawItem.name,
              shortDescription: rawItem.short_description,
              detailText: rawItem.detail_text,
              imageUrl: rawItem.image_url,
              displayOrder: index,
            },
          });
        }
      }

      // Pass 2: resolve next_waypoint_id -> Room.nextRoomId now that every
      // room in this museum has a real UUID.
      for (const wp of waypoints) {
        const nextRoomId = wp.next_waypoint_id ? roomIdByLegacyId.get(wp.next_waypoint_id) : null;
        await tx.room.update({
          where: { museumId_legacyId: { museumId: museum.id, legacyId: wp.id } },
          data: { nextRoomId: nextRoomId ?? null },
        });
      }
    });

    console.log(`Seeded museum "${spec.name}" (${spec.slug}): ${waypoints.length} rooms.`);
  }
}

async function main() {
  await seedSystemAdmin();
  await seedTierPricing();
  await seedMuseums();
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
