import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deterministicUuid } from './deterministicId.js';
import type { Museum } from '../src/modules/museums/schemas.js';
import type { Room } from '../src/modules/rooms/schemas.js';
import type { Item } from '../src/modules/items/schemas.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

interface RawItem {
  id: string;
  name: string;
  short_description: string;
  detail_text: string;
  image_url: string | null;
}

interface RawWaypoint {
  id: string;
  story_order: number;
  title: string;
  room_overview_text: string;
  room_narration_script: string;
  next_waypoint_id: string | null;
  items: RawItem[];
}

export interface MuseumFixtureSpec {
  slug: string;
  name: string;
  waypointsFile: string;
  systemPromptFile: string;
  adminEmail: string;
}

// The two content sets already sitting in data/. Both use room_1..room_4,
// which is the exact ID collision docs/backend-implementation-plan.md §16.1
// resolves via legacyId — the mock reproduces that resolution so client
// developers see the same shape the real seed will produce (§2.1 C3).
const MUSEUM_SPECS: MuseumFixtureSpec[] = [
  {
    slug: 'adwa',
    name: 'Adwa Victory Memorial Museum',
    waypointsFile: 'waypoints_adwa.json',
    systemPromptFile: 'system_prompt_adwa.md',
    adminEmail: 'admin@adwamuseum.org',
  },
  {
    slug: 'louvre',
    name: 'Louvre Museum',
    waypointsFile: 'waypoints_louvre.json',
    systemPromptFile: 'system_prompt_louvre.md',
    adminEmail: 'admin@louvre.fr',
  },
];

async function extractSystemPrompt(fileName: string): Promise<string> {
  const raw = await readFile(path.join(dataDir, fileName), 'utf-8');
  const [persona] = raw.split(/\nCONTEXT:/);
  return (persona ?? raw).trim();
}

export interface MockAdminUser {
  id: string;
  email: string;
  password: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  museumId: string | null;
}

export interface FixtureStore {
  museums: Museum[];
  rooms: Room[];
  items: Item[];
  adminUsers: MockAdminUser[];
}

export async function buildFixtures(): Promise<FixtureStore> {
  const museums: Museum[] = [];
  const rooms: Room[] = [];
  const items: Item[] = [];
  const adminUsers: MockAdminUser[] = [];
  const now = new Date().toISOString();

  adminUsers.push({
    id: deterministicUuid('system-admin'),
    email: 'system@adwa.dev',
    password: 'dev-password',
    role: 'SYSTEM_ADMIN',
    museumId: null,
  });

  for (const spec of MUSEUM_SPECS) {
    const museumId = deterministicUuid(`museum:${spec.slug}`);
    const systemPrompt = await extractSystemPrompt(spec.systemPromptFile);
    const raw = await readFile(path.join(dataDir, spec.waypointsFile), 'utf-8');
    const waypoints: RawWaypoint[] = JSON.parse(raw);

    museums.push({
      id: museumId,
      name: spec.name,
      slug: spec.slug,
      status: 'ACTIVE',
      ticketValidationUrl: null,
      systemPrompt,
      defaultVoiceId: null,
      createdAt: now,
      updatedAt: now,
    });

    adminUsers.push({
      id: deterministicUuid(`admin:${spec.slug}`),
      email: spec.adminEmail,
      password: 'dev-password',
      role: 'MUSEUM_ADMIN',
      museumId,
    });

    for (const wp of waypoints) {
      const roomId = deterministicUuid(`${spec.slug}:room:${wp.id}`);
      const nextRoomId = wp.next_waypoint_id
        ? deterministicUuid(`${spec.slug}:room:${wp.next_waypoint_id}`)
        : null;

      rooms.push({
        id: roomId,
        legacyId: wp.id,
        museumId,
        storyOrder: wp.story_order,
        title: wp.title,
        roomOverviewText: wp.room_overview_text,
        narrationScript: wp.room_narration_script,
        roomAudioUrl: null,
        nextRoomId,
        createdAt: now,
        updatedAt: now,
      });

      wp.items.forEach((rawItem, index) => {
        items.push({
          id: deterministicUuid(`${spec.slug}:item:${rawItem.id}`),
          legacyId: rawItem.id,
          roomId,
          name: rawItem.name,
          shortDescription: rawItem.short_description,
          detailText: rawItem.detail_text,
          imageUrl: rawItem.image_url,
          displayOrder: index,
          createdAt: now,
          updatedAt: now,
        });
      });
    }
  }

  return { museums, rooms, items, adminUsers };
}
