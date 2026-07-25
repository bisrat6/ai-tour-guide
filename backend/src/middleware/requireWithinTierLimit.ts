import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { resolveMuseumById } from '../lib/resolveMuseum.js';
import { TIER_LIMITS } from '../modules/billing/tiers.js';

type ResourceType = 'room' | 'item' | 'adminUser';

/**
 * Enforces subscription tier limits on resource creation (dev3 §8.3).
 *
 * - System admins are subject to limits too: a limit binds the museum, not the
 *   caller.
 * - Only creates are gated. Updates are never blocked, and a downgrade never
 *   deletes content that already exists.
 * - An inactive subscription blocks all creates.
 *
 * NOT CURRENTLY MOUNTED on any route — see docs/d3-integration-audit.md for
 * why, and for the two known weaknesses carried over from dev3's branch: the
 * count-then-create race, and the item branch silently passing when the request
 * has no roomId.
 *
 * @param getMuseumId resolves the owning museum, ideally via resolveMuseum
 *   rather than trusting a body field.
 */
export function requireWithinTierLimit(
  resource: ResourceType,
  getMuseumId: (req: Request) => Promise<string>,
) {
  return async function tierLimitGuard(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const museum = await resolveMuseumById(await getMuseumId(req));

      if (museum.subscriptionStatus !== 'ACTIVE') {
        next(ApiError.subscriptionInactive());
        return;
      }

      const limits = TIER_LIMITS[museum.tier];

      if (resource === 'room' && limits.maxRooms !== null) {
        const current = await prisma.room.count({ where: { museumId: museum.id } });
        if (current >= limits.maxRooms) {
          next(
            ApiError.tierLimitExceeded({
              limit: 'maxRooms',
              tier: museum.tier,
              allowed: limits.maxRooms,
              current,
            }),
          );
          return;
        }
      }

      if (resource === 'item' && limits.maxItemsPerRoom !== null) {
        // The item cap is per room, so it needs a roomId to count against.
        const { roomId } = req.body as { roomId?: string };
        if (roomId) {
          const current = await prisma.item.count({ where: { roomId } });
          if (current >= limits.maxItemsPerRoom) {
            next(
              ApiError.tierLimitExceeded({
                limit: 'maxItemsPerRoom',
                tier: museum.tier,
                allowed: limits.maxItemsPerRoom,
                current,
              }),
            );
            return;
          }
        }
      }

      if (resource === 'adminUser' && limits.maxAdminUsers !== null) {
        const current = await prisma.adminUser.count({ where: { museumId: museum.id } });
        if (current >= limits.maxAdminUsers) {
          next(
            ApiError.tierLimitExceeded({
              limit: 'maxAdminUsers',
              tier: museum.tier,
              allowed: limits.maxAdminUsers,
              current,
            }),
          );
          return;
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
