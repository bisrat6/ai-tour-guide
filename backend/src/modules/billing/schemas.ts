import { z } from 'zod';

export const subscriptionTierSchema = z.enum(['BASIC', 'PRO', 'ENTERPRISE']);

export const checkoutRequestSchema = z.object({
  tier: subscriptionTierSchema,
  // Honoured for SYSTEM_ADMIN only; a museum admin's own museum always wins.
  museumId: z.uuid().optional(),
});

export const manualTierRequestSchema = z.object({
  museumId: z.uuid(),
  tier: subscriptionTierSchema,
  subscriptionStatus: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
  subscriptionRenewsAt: z.iso.datetime().optional(),
  // Required so a manual override always leaves a reason in the audit trail.
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});

export const billingStatusQuerySchema = z.object({
  museumId: z.uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type ManualTierRequest = z.infer<typeof manualTierRequestSchema>;
export type BillingStatusQuery = z.infer<typeof billingStatusQuerySchema>;
