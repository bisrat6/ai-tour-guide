import { z } from 'zod';
import { paginatedResponseSchema, paginationQuerySchema } from '../../shared/pagination.js';
import { adminUserSchema } from '../museums/schemas.js';

/**
 * Admin user management. The console reaches this from two places: the tenant
 * Team screen (its own museum's seats) and the operator Admins screen (every
 * account, including other operators). Both are the same resource — the
 * difference is only which rows the caller is allowed to see, which the
 * service enforces from the token rather than from a query parameter.
 */

export const adminStatusSchema = z
  .enum(['ACTIVE', 'INVITED', 'SUSPENDED'])
  .meta({ id: 'AdminStatus' });

export const listAdminsQuerySchema = paginationQuerySchema.extend({
  museumId: z.uuid().optional().meta({
    description: 'SYSTEM_ADMIN only. A MUSEUM_ADMIN is always scoped to its own museum.',
  }),
  role: z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']).optional(),
  status: adminStatusSchema.optional(),
  search: z.string().min(1).max(200).optional(),
});

export const listAdminsResponseSchema = paginatedResponseSchema(adminUserSchema).meta({
  id: 'ListAdminsResponse',
});

/**
 * Creating an operator account. Museum seats are created through
 * POST /admin/museums/:id/admins, which already owns the museum lookup.
 */
export const createAdminRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8),
    displayName: z.string().min(1).max(200).optional(),
    role: z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']),
    museumId: z.uuid().optional().meta({ description: 'Required when role is MUSEUM_ADMIN.' }),
  })
  .refine((value) => value.role === 'SYSTEM_ADMIN' || value.museumId !== undefined, {
    message: 'museumId is required when role is MUSEUM_ADMIN',
    path: ['museumId'],
  })
  .meta({ id: 'CreateAdminRequest' });

/**
 * Role is deliberately absent: promoting a museum seat to an operator would
 * cross the tenant boundary in a single PATCH. Delete and re-create instead,
 * which leaves two audit entries rather than one ambiguous edit.
 */
export const updateAdminRequestSchema = z
  .object({
    displayName: z.string().min(1).max(200).nullable().optional(),
    status: adminStatusSchema.optional(),
    password: z.string().min(8).optional(),
  })
  .strict()
  .meta({ id: 'UpdateAdminRequest' });

export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;
export type CreateAdminRequest = z.infer<typeof createAdminRequestSchema>;
export type UpdateAdminRequest = z.infer<typeof updateAdminRequestSchema>;
