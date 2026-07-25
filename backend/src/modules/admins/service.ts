import type { AdminUser, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { writeAuditLog } from '../../lib/auditLog.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AdminContext } from '../../types/express.js';
import type { AdminUserDto } from '../museums/schemas.js';
import type { CreateAdminRequest, ListAdminsQuery, UpdateAdminRequest } from './schemas.js';

type AdminRowWithMuseum = AdminUser & { museum: { name: string } | null };

/** passwordHash never leaves this module. */
function toAdminDto(row: AdminRowWithMuseum): AdminUserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    museumId: row.museumId,
    museumName: row.museum?.name ?? null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function findAdminOrThrow(id: string): Promise<AdminRowWithMuseum> {
  const admin = await prisma.adminUser.findUnique({
    where: { id },
    include: { museum: { select: { name: true } } },
  });
  if (!admin) {
    throw ApiError.notFound('Admin user not found.');
  }
  return admin;
}

/**
 * A museum admin may only see and manage seats inside its own museum, and
 * never an operator account — which has museumId null and would otherwise
 * leak the existence of the control plane.
 */
function assertCanManage(actor: AdminContext, target: AdminRowWithMuseum): void {
  if (actor.role === 'SYSTEM_ADMIN') return;
  if (target.museumId === null || target.museumId !== actor.museumId) {
    throw ApiError.crossTenant('This account belongs to another museum.');
  }
}

export async function listAdmins(actor: AdminContext, query: ListAdminsQuery) {
  // Scope comes from the token. A museum admin's own museumId always wins over
  // whatever the query string asks for, and it can never see operator rows.
  const scopedMuseumId = actor.role === 'SYSTEM_ADMIN' ? query.museumId : actor.museumId;

  const where: Prisma.AdminUserWhereInput = {
    ...(scopedMuseumId !== undefined && scopedMuseumId !== null
      ? { museumId: scopedMuseumId }
      : {}),
    ...(actor.role === 'SYSTEM_ADMIN' ? {} : { role: 'MUSEUM_ADMIN' as const }),
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { displayName: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const rows = await prisma.adminUser.findMany({
    where,
    include: { museum: { select: { name: true } } },
    take: query.limit + 1,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    data: page.map(toAdminDto),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function createAdmin(
  actor: AdminContext,
  input: CreateAdminRequest,
): Promise<AdminUserDto> {
  const email = input.email.trim().toLowerCase();

  if (await prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
    throw ApiError.conflict('An admin with this email already exists.');
  }
  if (input.museumId) {
    const museum = await prisma.museum.findUnique({
      where: { id: input.museumId },
      select: { id: true },
    });
    if (!museum) throw ApiError.notFound('Museum not found.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const created = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        email,
        passwordHash,
        role: input.role,
        museumId: input.role === 'SYSTEM_ADMIN' ? null : (input.museumId ?? null),
        displayName: input.displayName ?? null,
        status: 'INVITED',
      },
      include: { museum: { select: { name: true } } },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId: admin.museumId,
      action: 'CREATE',
      entityType: 'AdminUser',
      entityId: admin.id,
      after: { email: admin.email, role: admin.role, museumId: admin.museumId },
    });

    return admin;
  });

  return toAdminDto(created);
}

export async function updateAdmin(
  actor: AdminContext,
  id: string,
  input: UpdateAdminRequest,
): Promise<AdminUserDto> {
  const before = await findAdminOrThrow(id);
  assertCanManage(actor, before);

  // Locking yourself out is always a mistake, never an intent worth honouring.
  if (id === actor.id && input.status !== undefined && input.status !== 'ACTIVE') {
    throw ApiError.conflict('You cannot suspend your own account.');
  }
  if (input.status === 'SUSPENDED') {
    await assertNotLastActiveAdmin(before, 'suspend');
  }

  const data: Prisma.AdminUserUpdateInput = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.status !== undefined) data.status = input.status;
  if (input.password !== undefined) data.passwordHash = await bcrypt.hash(input.password, 12);

  const updated = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.update({
      where: { id },
      data,
      include: { museum: { select: { name: true } } },
    });

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId: admin.museumId,
      action: 'UPDATE',
      entityType: 'AdminUser',
      entityId: admin.id,
      before: { displayName: before.displayName, status: before.status },
      // The new password is never logged, only the fact that one was set.
      after: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.password !== undefined ? { passwordChanged: true } : {}),
      },
    });

    return admin;
  });

  return toAdminDto(updated);
}

/**
 * A museum with no active administrator cannot be edited by anyone but an
 * operator, so removing the last one is refused rather than silently
 * stranding the tenant.
 */
async function assertNotLastActiveAdmin(
  target: AdminRowWithMuseum,
  verb: 'suspend' | 'delete',
): Promise<void> {
  if (target.museumId === null) return;
  if (target.status !== 'ACTIVE') return;

  const remaining = await prisma.adminUser.count({
    where: { museumId: target.museumId, status: 'ACTIVE', id: { not: target.id } },
  });
  if (remaining === 0) {
    throw ApiError.conflict(
      `This is the museum's last active administrator. Add another before you ${verb} this one.`,
    );
  }
}

export async function deleteAdmin(actor: AdminContext, id: string): Promise<void> {
  const target = await findAdminOrThrow(id);
  assertCanManage(actor, target);

  if (id === actor.id) {
    throw ApiError.conflict('You cannot delete your own account.');
  }
  await assertNotLastActiveAdmin(target, 'delete');

  await prisma.$transaction(async (tx) => {
    // AdminAuditLog.adminUserId is SetNull, so the trail this account left
    // behind outlives it — deliberately (§ audit retention).
    await tx.adminUser.delete({ where: { id } });

    await writeAuditLog(tx, {
      adminUserId: actor.id,
      museumId: target.museumId,
      action: 'DELETE',
      entityType: 'AdminUser',
      entityId: id,
      before: { email: target.email, role: target.role, museumId: target.museumId },
    });
  });
}
