import { AdminRole, MuseumStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SourceItem {
  id: string;
  name: string;
  short_description: string;
  detail_text: string;
  image_url: string | null;
}

interface SourceRoom {
  id: string;
  story_order: number;
  title: string;
  room_overview_text: string;
  room_narration_script: string;
  next_waypoint_id: string | null;
  items: SourceItem[];
}

interface MuseumSeedConfig {
  name: string;
  slug: string;
  waypointsFile: string;
  systemPromptFile: string;
}

const MUSEUMS: MuseumSeedConfig[] = [
  { name: 'Adwa Victory Museum', slug: 'adwa-museum', waypointsFile: 'waypoints_adwa.json', systemPromptFile: 'system_prompt_adwa.md' },
  { name: 'Louvre Museum', slug: 'louvre-museum', waypointsFile: 'waypoints_louvre.json', systemPromptFile: 'system_prompt_louvre.md' },
];

const DATA_DIR = path.join(__dirname, '../data');

/**
 * The persona text lives above the `CONTEXT:` marker in each system-prompt
 * file. The embedded CONTEXT payload below that marker duplicates the
 * waypoint JSON and would go stale the moment an admin edits content, so it
 * is discarded — context is assembled per request from the database (§16.2).
 */
function extractSystemPrompt(markdown: string): string {
  const marker = markdown.indexOf('\nCONTEXT:');
  const text = marker === -1 ? markdown : markdown.slice(0, marker);
  return text.trim();
}

async function seedMuseum(config: MuseumSeedConfig) {
  const waypointsPath = path.join(DATA_DIR, config.waypointsFile);
  const systemPromptPath = path.join(DATA_DIR, config.systemPromptFile);

  const rooms: SourceRoom[] = JSON.parse(fs.readFileSync(waypointsPath, 'utf-8'));
  const systemPrompt = extractSystemPrompt(fs.readFileSync(systemPromptPath, 'utf-8'));

  console.log(`Seeding museum "${config.name}" (${config.slug})...`);

  await prisma.$transaction(async (tx) => {
    const museum = await tx.museum.upsert({
      where: { slug: config.slug },
      create: { name: config.name, slug: config.slug, status: MuseumStatus.ACTIVE, systemPrompt },
      update: { name: config.name, systemPrompt },
    });

    // Pass 1: create/update every room and its items, without nextRoomId —
    // the target room may not exist yet (C3: legacy IDs collide across museums,
    // resolved here by scoping legacyId uniqueness to museumId, §6.2).
    const legacyIdToRoomId = new Map<string, string>();

    for (const sourceRoom of rooms) {
      const room = await tx.room.upsert({
        where: { museumId_legacyId: { museumId: museum.id, legacyId: sourceRoom.id } },
        create: {
          museumId: museum.id,
          legacyId: sourceRoom.id,
          storyOrder: sourceRoom.story_order,
          title: sourceRoom.title,
          roomOverviewText: sourceRoom.room_overview_text,
          narrationScript: sourceRoom.room_narration_script,
        },
        update: {
          storyOrder: sourceRoom.story_order,
          title: sourceRoom.title,
          roomOverviewText: sourceRoom.room_overview_text,
          narrationScript: sourceRoom.room_narration_script,
        },
      });

      legacyIdToRoomId.set(sourceRoom.id, room.id);

      for (const [index, sourceItem] of sourceRoom.items.entries()) {
        await tx.item.upsert({
          where: { roomId_legacyId: { roomId: room.id, legacyId: sourceItem.id } },
          create: {
            roomId: room.id,
            legacyId: sourceItem.id,
            name: sourceItem.name,
            shortDescription: sourceItem.short_description,
            detailText: sourceItem.detail_text,
            imageUrl: sourceItem.image_url,
            displayOrder: index,
          },
          update: {
            name: sourceItem.name,
            shortDescription: sourceItem.short_description,
            detailText: sourceItem.detail_text,
            imageUrl: sourceItem.image_url,
            displayOrder: index,
          },
        });
      }
    }

    // Pass 2: now that every legacy ID maps to a real UUID, resolve nextRoomId.
    for (const sourceRoom of rooms) {
      if (!sourceRoom.next_waypoint_id) continue;
      const roomId = legacyIdToRoomId.get(sourceRoom.id);
      const nextRoomId = legacyIdToRoomId.get(sourceRoom.next_waypoint_id);
      if (!roomId || !nextRoomId) continue;
      await tx.room.update({ where: { id: roomId }, data: { nextRoomId } });
    }

    // One MUSEUM_ADMIN per museum for local development.
    const adminEmail = `admin@${config.slug}.local`;
    const adminPassword = process.env.SEED_MUSEUM_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await tx.adminUser.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, passwordHash, role: AdminRole.MUSEUM_ADMIN, museumId: museum.id },
      update: { passwordHash, museumId: museum.id },
    });
  });

  console.log(`Finished seeding "${config.name}": ${rooms.length} rooms.`);
}

async function seedSystemAdmin() {
  const email = process.env.SEED_SYSTEM_ADMIN_EMAIL ?? 'admin@aitourguide.org';
  const password = process.env.SEED_SYSTEM_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, role: AdminRole.SYSTEM_ADMIN },
    update: { passwordHash },
  });
  console.log(`Seeded system admin: ${email}`);
}

async function main() {
  console.log('Seeding database (idempotent — matches on Museum.slug and legacyId)...');
  await seedSystemAdmin();
  for (const museum of MUSEUMS) {
    await seedMuseum(museum);
  }
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
