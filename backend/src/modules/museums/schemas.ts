import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * §14.1 Museums.
 */

export const museumStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']).meta({ id: 'MuseumStatus' });
export const gateModeSchema = z.enum(['TICKET_CODE', 'STAFF_ASSISTED']).meta({ id: 'GateMode' });
export const guideStyleToneSchema = z
  .enum(['FORMAL', 'CONVERSATIONAL', 'SCHOLARLY'])
  .meta({ id: 'GuideStyleTone' });

/**
 * Every configurable field a museum admin can see, in one object. The console
 * splits these across four settings tabs (museum / gate / guide / voice); the
 * API keeps them on the one row they belong to rather than inventing four
 * resources over a single table.
 */
export const museumSchema = z
  .object({
    id: z.uuid(),
    name: z.string().meta({ example: 'Adwa Victory Memorial Museum' }),
    slug: z.string().meta({ example: 'adwa' }),
    status: museumStatusSchema,
    cityCountry: z.string().nullable().meta({ example: 'Adwa, Ethiopia' }),

    // Gate
    ticketValidationUrl: z.url().nullable(),
    gateMode: gateModeSchema,
    allowedTicketPrefix: z.string().nullable(),
    graceWindowMinutes: z.int().min(0),

    // Guide
    systemPrompt: z.string().nullable().meta({ description: 'Grounding policy for chat.' }),
    personaName: z.string().nullable(),
    guideStyleTone: guideStyleToneSchema,

    // Voice
    defaultVoiceId: z.string().nullable(),
    speakingRate: z.number().meta({ description: 'Multiplier on the provider default. 1 = normal.' }),
    pronunciationHints: z.string().nullable(),

    // Subscription (read-only here; changed through /admin/billing)
    tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
    subscriptionStatus: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']),
    subscriptionRenewsAt: z.iso.datetime().nullable(),

    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Museum' });

/**
 * Counts the fleet and overview screens need. Kept off the plain Museum so the
 * common read stays a single row fetch — a caller opts in with ?withStats=true.
 */
export const museumStatsSchema = z
  .object({
    roomCount: z.int().min(0),
    itemCount: z.int().min(0),
    adminCount: z.int().min(0),
    /** Rooms whose narrationScript is still empty or placeholder-short. */
    roomsMissingNarration: z.int().min(0),
    /** Rooms with no items attached yet. */
    roomsWithoutItems: z.int().min(0),
    /**
     * Rooms that are narrated *and* have at least one item. Not derivable from
     * the two counts above, which overlap: a room can be both.
     */
    roomsReady: z.int().min(0),
    /** Rooms reachable by following nextRoomId from the lowest storyOrder. */
    roomsInSequence: z.int().min(0),
    lastEditedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'MuseumStats' });

export const museumWithStatsSchema = museumSchema
  .extend({ stats: museumStatsSchema })
  .meta({ id: 'MuseumWithStats' });

export const listMuseumsQuerySchema = paginationQuerySchema.extend({
  withStats: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true')
    .meta({ description: 'Include per-museum counts. Costs one aggregate query per page.' }),
  status: museumStatusSchema.optional(),
  /** Case-insensitive match against name or slug. */
  search: z.string().min(1).max(200).optional(),
});
export const listMuseumsResponseSchema = paginatedResponseSchema(museumSchema).meta({
  id: 'ListMuseumsResponse',
});

export const getMuseumQuerySchema = z.object({
  withStats: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const createMuseumRequestSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
    cityCountry: z.string().min(1).max(200).optional(),
    adminEmail: z.email(),
    adminPassword: z.string().min(8),
  })
  .meta({ id: 'CreateMuseumRequest' });

export const createMuseumResponseSchema = z
  .object({
    museum: museumSchema,
    admin: z.object({
      id: z.uuid(),
      email: z.email(),
      role: z.literal('MUSEUM_ADMIN'),
      museumId: z.uuid(),
    }),
  })
  .meta({ id: 'CreateMuseumResponse' });

/**
 * status is SYSTEM_ADMIN-only; everything else is writable by the museum's own
 * admin (§14.1) — the service layer enforces that split, this schema only
 * shapes what a PATCH body may contain.
 *
 * .strict() is deliberate. Zod's default strips unknown keys, which turned a
 * rejected field into a silent no-op: the console sent `name`, got 200 back,
 * and showed a success toast over an unchanged row. An unknown key is now a
 * 400 that names itself.
 */
export const updateMuseumRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens')
      .optional(),
    status: museumStatusSchema.optional(),
    cityCountry: z.string().max(200).nullable().optional(),

    ticketValidationUrl: z.url().nullable().optional(),
    gateMode: gateModeSchema.optional(),
    allowedTicketPrefix: z.string().max(64).nullable().optional(),
    graceWindowMinutes: z.int().min(0).max(1440).optional(),

    systemPrompt: z.string().nullable().optional(),
    personaName: z.string().max(200).nullable().optional(),
    guideStyleTone: guideStyleToneSchema.optional(),

    defaultVoiceId: z.string().nullable().optional(),
    speakingRate: z.number().min(0.5).max(2).optional(),
    pronunciationHints: z.string().nullable().optional(),
  })
  .strict()
  .meta({ id: 'UpdateMuseumRequest' });

export const addMuseumAdminRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
    displayName: z.string().min(1).max(200).optional(),
  })
  .meta({ id: 'AddMuseumAdminRequest' });

export const adminUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().nullable(),
    role: z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']),
    status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']),
    museumId: z.uuid().nullable(),
    museumName: z.string().nullable(),
    lastLoginAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AdminUser' });

export type Museum = z.infer<typeof museumSchema>;
export type MuseumStats = z.infer<typeof museumStatsSchema>;
export type MuseumWithStats = z.infer<typeof museumWithStatsSchema>;
export type ListMuseumsQuery = z.infer<typeof listMuseumsQuerySchema>;
export type CreateMuseumRequest = z.infer<typeof createMuseumRequestSchema>;
export type UpdateMuseumRequest = z.infer<typeof updateMuseumRequestSchema>;
export type AddMuseumAdminRequest = z.infer<typeof addMuseumAdminRequestSchema>;
export type AdminUserDto = z.infer<typeof adminUserSchema>;
