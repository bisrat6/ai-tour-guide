import type { SubscriptionTier } from '@prisma/client';

/**
 * Tier limits live in code so that changing one needs a code review and a test
 * run. Prices live in the TierPricing table so a price change is a data edit,
 * not a deploy (dev3 §4.1).
 *
 * NOTE: these values are not currently enforced on the admin routes — see
 * docs/d3-integration-audit.md. BASIC allows a single room, while both seeded
 * demo museums have four, so enforcing them needs the numbers revisited first.
 */

export interface TierLimit {
  /** null means unlimited. */
  maxRooms: number | null;
  maxItemsPerRoom: number | null;
  maxAdminUsers: number | null;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimit> = {
  BASIC: {
    maxRooms: 1,
    maxItemsPerRoom: 20,
    maxAdminUsers: 1,
  },
  PRO: {
    maxRooms: 3,
    maxItemsPerRoom: 50,
    maxAdminUsers: 5,
  },
  ENTERPRISE: {
    maxRooms: null,
    maxItemsPerRoom: null,
    maxAdminUsers: null,
  },
};
