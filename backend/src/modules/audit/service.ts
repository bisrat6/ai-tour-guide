import type { AdminAuditLog, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AdminContext } from '../../types/express.js';
import type { AuditLogDto, ListAuditLogsQuery } from './schemas.js';

type AuditRow = AdminAuditLog & {
  museum: { name: string } | null;
  adminUser: { email: string; displayName: string | null; role: 'SYSTEM_ADMIN' | 'MUSEUM_ADMIN' } | null;
};

/**
 * The snapshots are free-form JSON, so this reads defensively: a row written
 * by an older version of a service may not carry the key being looked for.
 */
function readLabel(snapshot: Prisma.JsonValue | null): string | null {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  for (const key of ['title', 'name', 'email', 'slug'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function toAuditDto(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    action: row.action as AuditLogDto['action'],
    entityType: row.entityType,
    entityId: row.entityId,
    // `after` first: for an update, the name the row has now is the more
    // useful one to show. A delete only has `before`, which is the fallback.
    entityLabel: readLabel(row.after) ?? readLabel(row.before) ?? row.entityId,

    museumId: row.museumId,
    museumName: row.museum?.name ?? null,

    actorId: row.adminUserId,
    actorEmail: row.adminUser?.email ?? null,
    actorDisplayName: row.adminUser?.displayName ?? null,
    actorRole: row.adminUser?.role ?? null,

    before: row.before,
    after: row.after,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAuditLogs(actor: AdminContext, query: ListAuditLogsQuery) {
  // Scope from the token, never from the query string. A museum admin sees
  // only its own museum's trail; rows with a null museumId are control-plane
  // events and stay invisible to it.
  const scopedMuseumId = actor.role === 'SYSTEM_ADMIN' ? query.museumId : actor.museumId;

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(scopedMuseumId ? { museumId: scopedMuseumId } : {}),
    ...(actor.role === 'SYSTEM_ADMIN' ? {} : { museumId: actor.museumId }),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { adminUserId: query.actorId } : {}),
    ...(query.since || query.until
      ? {
          createdAt: {
            ...(query.since ? { gte: new Date(query.since) } : {}),
            ...(query.until ? { lt: new Date(query.until) } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.adminAuditLog.findMany({
    where,
    include: {
      museum: { select: { name: true } },
      adminUser: { select: { email: true, displayName: true, role: true } },
    },
    take: query.limit + 1,
    // Newest first: an audit trail is read from the top.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map(toAuditDto),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
