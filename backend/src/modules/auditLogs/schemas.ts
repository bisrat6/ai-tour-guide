import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';

/**
 * `action` and `entityType` are plain strings on the row rather than enums, so
 * the response describes them rather than constraining them. A new entity type
 * appearing in the trail must not make the endpoint start returning 500s.
 */
export const auditLogEntrySchema = z
  .object({
    id: z.uuid(),
    action: z.string().meta({ example: 'UPDATE' }),
    entityType: z.string().meta({ example: 'Room' }),
    entityId: z.string(),
    museumId: z.uuid().nullable(),
    museumName: z.string().nullable(),
    // Null when nobody was behind the change: the payment reconciler runs
    // unattended, and an account can be deleted while its trail lives on.
    adminUserId: z.uuid().nullable(),
    adminEmail: z.email().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'AuditLogEntry' });

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  museumId: z
    .uuid()
    .optional()
    .meta({ description: 'System admin only; a museum admin always sees its own museum.' }),
});

export const listAuditLogsResponseSchema = paginatedResponseSchema(auditLogEntrySchema).meta({
  id: 'ListAuditLogsResponse',
});

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
