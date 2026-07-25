import { z } from 'zod';

/**
 * §8 Authentication and authorization.
 */

export const adminRoleSchema = z.enum(['SYSTEM_ADMIN', 'MUSEUM_ADMIN']).meta({
  id: 'AdminRole',
});

export const loginRequestSchema = z
  .object({
    email: z.email().meta({ example: 'admin@adwamuseum.org' }),
    password: z.string().min(1).meta({ example: 'correct-horse-battery-staple' }),
  })
  .meta({ id: 'LoginRequest' });

export const loginResponseSchema = z
  .object({
    token: z.string().meta({ description: 'JWT, 12-hour expiry.' }),
    role: adminRoleSchema,
    museumId: z.string().nullable().meta({ description: 'null for SYSTEM_ADMIN.' }),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'LoginResponse' });

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
