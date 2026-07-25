import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * §14.1 Museums.
 */

export const museumStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']).meta({ id: 'MuseumStatus' });

export const museumSchema = z
  .object({
    id: z.uuid(),
    name: z.string().meta({ example: 'Adwa Victory Memorial Museum' }),
    slug: z.string().meta({ example: 'adwa' }),
    status: museumStatusSchema,
    ticketValidationUrl: z.url().nullable(),
    systemPrompt: z.string().nullable(),
    defaultVoiceId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Museum' });

export const listMuseumsQuerySchema = paginationQuerySchema;
export const listMuseumsResponseSchema = paginatedResponseSchema(museumSchema).meta({
  id: 'ListMuseumsResponse',
});

export const createMuseumRequestSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
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

// status is SYSTEM_ADMIN-only; the other three fields are writable by the
// museum's own admin (§14.1) — the router/service layer enforces that split,
// this schema only shapes what a PATCH body may contain.
export const updateMuseumRequestSchema = z
  .object({
    status: museumStatusSchema.optional(),
    ticketValidationUrl: z.url().nullable().optional(),
    systemPrompt: z.string().nullable().optional(),
    defaultVoiceId: z.string().nullable().optional(),
  })
  .meta({ id: 'UpdateMuseumRequest' });

export const addMuseumAdminRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
  })
  .meta({ id: 'AddMuseumAdminRequest' });

export const adminUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']),
    museumId: z.uuid().nullable(),
  })
  .meta({ id: 'AdminUser' });

export type Museum = z.infer<typeof museumSchema>;
export type CreateMuseumRequest = z.infer<typeof createMuseumRequestSchema>;
export type UpdateMuseumRequest = z.infer<typeof updateMuseumRequestSchema>;
export type AddMuseumAdminRequest = z.infer<typeof addMuseumAdminRequestSchema>;
