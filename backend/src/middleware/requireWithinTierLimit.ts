import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { TIER_LIMITS } from '../modules/billing/tiers.js';
import { resolveMuseumById } from '../lib/resolveMuseum.js';

type ResourceType = 'room' | 'item' | 'adminUser';

/**
 * Middleware that enforces subscription tier limits on resource creation.
 *
 * Rules (from dev3 §8.3):
 * - System admins ARE subject to limits (limits bind the museum, not the caller)
 * - Updates (PATCH) are NEVER gated — only creates
 * - Downgrades never delete existing content
 * - If subscriptionStatus !== 'ACTIVE', all creates are blocked
 *
 * @param resource - which resource type is being created
 * @param getMuseumId - a function that extracts the museumId from the request
 *   using the shared resolveMuseum helper (never from a body field)
 */
export function requireWithinTierLimit(
  resource: ResourceType,
  getMuseumId: (req: Request) => Promise<string>,
) {
  return async function (req: Request, _res: Response, next: NextFunction) {
    try {
      const museumId = await getMuseumId(req);
      const museum = await resolveMuseumById(museumId);

      // Block creates on inactive subscriptions
      if (museum.subscriptionStatus !== 'ACTIVE') {
        return next(ApiError.subscriptionInactive());
      }

      const limits = TIER_LIMITS[museum.tier];

      if (resource === 'room') {
        const max = limits.maxRooms;
        if (max !== null) {
          const current = await prisma.room.count({ where: { museumId } });
          if (current >= max) {
            return next(ApiError.tierLimitExceeded({ limit: 'maxRooms', tier: museum.tier, allowed: max, current }));
          }
        }
      }

      if (resource === 'item') {
        // Item limit is per-room, not per-museum. roomId comes from body.
        const roomId = (req.body as { roomId?: string }).roomId;
        if (roomId) {
          const max = limits.maxItemsPerRoom;
          if (max !== null) {
            const current = await prisma.item.count({ where: { roomId } });
            if (current >= max) {
              return next(ApiError.tierLimitExceeded({ limit: 'maxItemsPerRoom', tier: museum.tier, allowed: max, current }));
            }
          }
        }
      }

      if (resource === 'adminUser') {
        const max = limits.maxAdminUsers;
        if (max !== null) {
          const current = await prisma.adminUser.count({ where: { museumId } });
          if (current >= max) {
            return next(ApiError.tierLimitExceeded({ limit: 'maxAdminUsers', tier: museum.tier, allowed: max, current }));
          }
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
