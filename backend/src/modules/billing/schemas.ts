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

export const spendWindowSchema = z.enum(['7d', '30d', '90d']);

export const spendQuerySchema = z.object({
  window: spendWindowSchema.default('30d'),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

/**
 * Revenue actually collected per museum, not a forecast: only PAID rows inside
 * the window count, keyed off paidAt rather than createdAt so a payment that
 * took three days to clear lands in the period it settled in.
 */
export const spendRowSchema = z
  .object({
    museumId: z.uuid(),
    museumName: z.string(),
    slug: z.string(),
    cityCountry: z.string().nullable(),
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    tier: subscriptionTierSchema,
    subscriptionStatus: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED']),
    paidAmountEtb: z.string().meta({ description: 'Fixed to 2 decimal places.' }),
    paymentCount: z.int().min(0),
    lastPaidAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'SpendRow' });

export const spendResponseSchema = z
  .object({
    window: spendWindowSchema,
    since: z.iso.datetime(),
    currency: z.literal('ETB'),
    totalEtb: z.string(),
    rows: z.array(spendRowSchema),
  })
  .meta({ id: 'SpendResponse' });

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type ManualTierRequest = z.infer<typeof manualTierRequestSchema>;
export type BillingStatusQuery = z.infer<typeof billingStatusQuerySchema>;
export type SpendQuery = z.infer<typeof spendQuerySchema>;
export type SpendResponse = z.infer<typeof spendResponseSchema>;
