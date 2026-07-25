import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * Read side of AdminAuditLog. Every admin write already appends a row inside
 * its own transaction (lib/auditLog.ts); this is the only way to read them
 * back. The operator audit trail and the tenant activity feed are the same
 * query with a different scope, so they share one route.
 */

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE']).meta({ id: 'AuditAction' });

export const auditEntityTypeSchema = z
  .enum(['Museum', 'Room', 'Item', 'AdminUser', 'Payment'])
  .meta({ id: 'AuditEntityType' });

export const auditLogSchema = z
  .object({
    id: z.uuid(),
    action: auditActionSchema,
    entityType: z.string(),
    entityId: z.string(),
    /**
     * Best-effort human name for the row that changed, lifted from the
     * before/after snapshot. Falls back to the id when the snapshot carried
     * no title or name — the client should render it as-is either way.
     */
    entityLabel: z.string(),

    museumId: z.uuid().nullable(),
    museumName: z.string().nullable(),

    /** Null when the actor was the payment reconciler rather than a person. */
    actorId: z.uuid().nullable(),
    actorEmail: z.string().nullable(),
    actorDisplayName: z.string().nullable(),
    actorRole: z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']).nullable(),

    before: z.unknown().nullable(),
    after: z.unknown().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AuditLogEntry' });

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  museumId: z.uuid().optional().meta({
    description: 'SYSTEM_ADMIN only. A MUSEUM_ADMIN is always scoped to its own museum.',
  }),
  entityType: z.string().min(1).max(50).optional(),
  action: auditActionSchema.optional(),
  actorId: z.uuid().optional(),
  since: z.iso.datetime().optional().meta({ description: 'Inclusive lower bound on createdAt.' }),
  until: z.iso.datetime().optional().meta({ description: 'Exclusive upper bound on createdAt.' }),
});

export const listAuditLogsResponseSchema = paginatedResponseSchema(auditLogSchema).meta({
  id: 'ListAuditLogsResponse',
});

export type AuditLogDto = z.infer<typeof auditLogSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
