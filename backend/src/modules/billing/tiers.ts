import type { SubscriptionTier } from '@prisma/client';

/**
 * Tier limits live in code so that a change requires a code review and a test
 * run. Prices live in the TierPricing database table so a price change is a
 * data edit, not a deploy.
 */

export interface TierLimit {
  maxRooms: number | null;          // null = unlimited
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
} as const;
