import { z } from 'zod';
import { museumStatsSchema } from '../museums/schemas.js';

/**
 * Two read-only dashboards: the tenant overview (one museum's authoring
 * readiness) and the operator system health screen (this process's view of
 * its own dependencies). Neither is derivable from the CRUD routes without
 * the client making a dozen requests and doing the arithmetic itself.
 */

export const roomReadinessSchema = z
  .object({
    id: z.uuid(),
    storyOrder: z.int(),
    title: z.string(),
    /**
     * ready — narration written and at least one item.
     * incomplete — narration written but nothing to look at yet.
     * empty — no usable narration script.
     */
    readiness: z.enum(['ready', 'incomplete', 'empty']),
    itemCount: z.int().min(0),
    narrationChars: z.int().min(0),
    hasAudio: z.boolean(),
    inSequence: z.boolean().meta({
      description: 'Reachable by following nextRoomId from the first room.',
    }),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'RoomReadiness' });

export const tenantOverviewSchema = z
  .object({
    museumId: z.uuid(),
    museumName: z.string(),
    stats: museumStatsSchema,
    rooms: z.array(roomReadinessSchema),
    tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
    subscriptionStatus: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']),
    limits: z.object({
      maxRooms: z.int().nullable(),
      maxItemsPerRoom: z.int().nullable(),
      maxAdminUsers: z.int().nullable(),
    }),
  })
  .meta({ id: 'TenantOverview' });

export const overviewQuerySchema = z.object({
  museumId: z.uuid().optional().meta({
    description: 'Required for SYSTEM_ADMIN. Ignored for MUSEUM_ADMIN.',
  }),
});

/**
 * One outbound dependency. `mode` separates "a real vendor is wired up" from
 * "the in-process fake is answering", which matters far more on this screen
 * than latency does — a green board backed by fakes is worse than a red one.
 */
export const adapterHealthSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    provider: z.string(),
    mode: z.enum(['live', 'fake', 'unconfigured']),
    state: z.enum(['healthy', 'degraded', 'retrying', 'breaker_open', 'unknown']),
    consecutiveFailures: z.int().min(0),
    breakerOpenedAt: z.iso.datetime().nullable(),
    timeoutMs: z.int().nullable(),
    note: z.string(),
  })
  .meta({ id: 'AdapterHealth' });

export const systemHealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    version: z.string(),
    environment: z.string(),
    dbLatencyMs: z.int().min(0),
    uptimeSeconds: z.int().min(0),
    adapters: z.array(adapterHealthSchema),
    checkedAt: z.iso.datetime(),
  })
  .meta({ id: 'SystemHealth' });

export type RoomReadiness = z.infer<typeof roomReadinessSchema>;
export type TenantOverview = z.infer<typeof tenantOverviewSchema>;
export type AdapterHealth = z.infer<typeof adapterHealthSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
