import type { Prisma } from '@prisma/client';

/**
 * §14 requires every admin write to append an AdminAuditLog row inside the
 * same transaction as the write itself — a log written after commit could
 * silently vanish if the process crashes in between. Callers always pass a
 * transaction client (never the bare `prisma` singleton).
 */
export interface AuditLogEntry {
  adminUserId: string;
  museumId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditLogEntry,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      adminUserId: entry.adminUserId,
      museumId: entry.museumId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === undefined ? undefined : (entry.before as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (entry.after as Prisma.InputJsonValue),
    },
  });
}
