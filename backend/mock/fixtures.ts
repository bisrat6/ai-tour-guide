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
  displayName: string | null;
  password: string;
  role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  museumId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Mirrors AdminAuditLog closely enough for the console's audit and activity screens. */
export interface MockAuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  museumId: string | null;
  adminUserId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

/** Mirrors Payment. The mock takes no money, so a payment only ever moves when a caller says so. */
export interface MockPayment {
  id: string;
  museumId: string;
  txRef: string;
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  amountEtb: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  paidAt: string | null;
  chapaReference: string | null;
  createdAt: string;
}

export interface FixtureStore {
  museums: Museum[];
  rooms: Room[];
  items: Item[];
  adminUsers: MockAdminUser[];
  auditLogs: MockAuditLog[];
  payments: MockPayment[];
}

export async function buildFixtures(): Promise<FixtureStore> {
  const museums: Museum[] = [];
  const rooms: Room[] = [];
  const items: Item[] = [];
  const adminUsers: MockAdminUser[] = [];
  const auditLogs: MockAuditLog[] = [];
  const now = new Date().toISOString();

  adminUsers.push({
    id: deterministicUuid('system-admin'),
    email: 'system@adwa.dev',
    displayName: 'System Operator',
    password: 'dev-password',
    role: 'SYSTEM_ADMIN',
    status: 'ACTIVE',
    museumId: null,
    lastLoginAt: null,
    createdAt: now,
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
      cityCountry: null,

      ticketValidationUrl: null,
      gateMode: 'TICKET_CODE',
      allowedTicketPrefix: null,
      graceWindowMinutes: 30,

      systemPrompt,
      personaName: null,
      guideStyleTone: 'CONVERSATIONAL',

      defaultVoiceId: null,
      speakingRate: 1,
      pronunciationHints: null,

      tier: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      subscriptionRenewsAt: null,

      createdAt: now,
      updatedAt: now,
    });

    adminUsers.push({
      id: deterministicUuid(`admin:${spec.slug}`),
      email: spec.adminEmail,
      displayName: null,
      password: 'dev-password',
      role: 'MUSEUM_ADMIN',
      status: 'ACTIVE',
      museumId,
      lastLoginAt: null,
      createdAt: now,
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

  // A short seeded trail so the audit and activity screens render something
  // on a cold start rather than an empty state that looks like a bug.
  const firstMuseum = museums[0];
  const firstRoom = rooms[0];
  if (firstMuseum && firstRoom) {
    auditLogs.push({
      id: deterministicUuid('audit:seed:1'),
      action: 'CREATE',
      entityType: 'Museum',
      entityId: firstMuseum.id,
      museumId: firstMuseum.id,
      adminUserId: adminUsers[0]?.id ?? null,
      before: null,
      after: { name: firstMuseum.name, slug: firstMuseum.slug },
      createdAt: now,
    });
    auditLogs.push({
      id: deterministicUuid('audit:seed:2'),
      action: 'UPDATE',
      entityType: 'Room',
      entityId: firstRoom.id,
      museumId: firstMuseum.id,
      adminUserId: adminUsers[1]?.id ?? null,
      before: { title: firstRoom.title },
      after: { title: firstRoom.title, narrationScript: '(edited)' },
      createdAt: now,
    });
  }

  return { museums, rooms, items, adminUsers, auditLogs, payments: [] };
}
