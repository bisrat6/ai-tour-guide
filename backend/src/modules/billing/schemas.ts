import { z } from 'zod';

export const checkoutSchema = z.object({
  tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  museumId: z.string().uuid().optional(), // system admin only; museum admin ignores this
});

export const manualTierSchema = z.object({
  museumId: z.string().uuid(),
  tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  subscriptionStatus: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
  subscriptionRenewsAt: z.string().datetime().optional(),
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});

export const billingStatusQuerySchema = z.object({
  museumId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
