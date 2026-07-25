import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { prisma } from '../../src/lib/prisma.js';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const TRUNCATE_SQL = `
  TRUNCATE TABLE
    "AdminAuditLog",
    "ChatAnswer",
    "AudioAsset",
    "Item",
    "Room",
    "AdminUser",
    "Museum"
  RESTART IDENTITY CASCADE;
`;

let schemaReady = false;

/**
 * Applies migrations to the test database once per process. Safe to call
 * from beforeAll — subsequent calls are no-ops.
 */
export function ensureTestSchema(): void {
  if (schemaReady) return;
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Integration tests refuse to run against DATABASE_URL.',
    );
  }
  // prisma migrate deploy reads DATABASE_URL via prisma.config.ts; testEnv.ts
  // has already swapped TEST_DATABASE_URL into DATABASE_URL for this process.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
    cwd: backendRoot,
  });
  schemaReady = true;
}

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
}

export async function seedAdmin(opts: {
  email: string;
  password: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  museumId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 12);
  return prisma.adminUser.create({
    data: {
      email: opts.email.trim().toLowerCase(),
      passwordHash,
      role: opts.role,
      museumId: opts.museumId ?? null,
    },
  });
}

export async function seedMuseum(opts: {
  name: string;
  slug: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  systemPrompt?: string;
}) {
  return prisma.museum.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      status: opts.status ?? 'ACTIVE',
      systemPrompt: opts.systemPrompt ?? 'You are a museum guide.',
    },
  });
}

export async function seedRoom(opts: {
  museumId: string;
  legacyId: string;
  storyOrder: number;
  title: string;
  nextRoomId?: string | null;
}) {
  return prisma.room.create({
    data: {
      museumId: opts.museumId,
      legacyId: opts.legacyId,
      storyOrder: opts.storyOrder,
      title: opts.title,
      roomOverviewText: `${opts.title} overview`,
      narrationScript: `${opts.title} narration`,
      nextRoomId: opts.nextRoomId ?? null,
    },
  });
}

export async function seedItem(opts: {
  roomId: string;
  legacyId?: string;
  name: string;
  displayOrder?: number;
}) {
  return prisma.item.create({
    data: {
      roomId: opts.roomId,
      legacyId: opts.legacyId ?? null,
      name: opts.name,
      shortDescription: `${opts.name} short description`,
      detailText: `${opts.name} detail text`,
      displayOrder: opts.displayOrder ?? 0,
    },
  });
}

export async function seedChatAnswer(opts: {
  roomId: string;
  itemId?: string;
  questionHash: string;
}) {
  return prisma.chatAnswer.create({
    data: {
      roomId: opts.roomId,
      itemId: opts.itemId ?? null,
      questionHash: opts.questionHash,
      question: 'What is this room about?',
      answer: 'A cached answer.',
    },
  });
}
