import { prisma } from '../../lib/prisma.js';
import type { AdminContext } from '../../types/express.js';
import type { AuditLogEntry, ListAuditLogsQuery } from './schemas.js';

/**
 * Reads the trail every admin mutation already writes.
 *
 * Newest first, which is the only order anyone reads an audit log in, so the
 * cursor walks backwards through `(createdAt, id)`. The existing
 * `@@index([museumId, createdAt])` serves the scoped case; the unscoped
 * system-admin case is a plain reverse scan.
 *
 * `before` and `after` are deliberately not returned: they hold arbitrary
 * snapshots of whatever was written, which is more than a list view needs and
 * more than is safe to hand out without thinking about what is in them.
 */
export async function listAuditLogs(
  admin: AdminContext,
  query: ListAuditLogsQuery,
): Promise<{ data: AuditLogEntry[]; nextCursor: string | null }> {
  // A museum admin always sees its own museum; any supplied id is ignored
  // rather than refused, matching how billing status resolves the same choice.
  const museumId = admin.role === 'SYSTEM_ADMIN' ? query.museumId : admin.museumId;

  const rows = await prisma.adminAuditLog.findMany({
    ...(museumId === undefined || museumId === null ? {} : { where: { museumId } }),
    take: query.limit + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      museumId: true,
      adminUserId: true,
      createdAt: true,
      museum: { select: { name: true } },
      adminUser: { select: { email: true } },
    },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      museumId: row.museumId,
      museumName: row.museum?.name ?? null,
      adminUserId: row.adminUserId,
      adminEmail: row.adminUser?.email ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
