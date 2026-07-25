import { deterministicUuid } from './deterministicId.js';
import {
  extractSystemPrompt,
  loadWaypoints,
  MUSEUM_SEED_SPECS,
} from '../src/shared/museumSeedData.js';
import type { Museum } from '../src/modules/museums/schemas.js';
import type { Room } from '../src/modules/rooms/schemas.js';
import type { Item } from '../src/modules/items/schemas.js';

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

  for (const spec of MUSEUM_SEED_SPECS) {
    const museumId = deterministicUuid(`museum:${spec.slug}`);
    const systemPrompt = await extractSystemPrompt(spec.systemPromptFile);
    const waypoints = await loadWaypoints(spec.waypointsFile);

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
