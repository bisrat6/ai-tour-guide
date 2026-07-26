/**
 * Between the audit trail on the wire and the row the operator reads.
 *
 * The server records a verb and an entity type separately — `UPDATE` of a
 * `Room` — where the page wants one phrase. Composing them here rather than
 * mapping onto the old fixture enum means a new entity type shows up as itself
 * instead of being dropped or mislabelled.
 */

import type { ApiAuditLogEntry } from '../../api/types.ts'
import type { StatusTone } from '../../kit/index.ts'

/**
 * Who was behind the change. `system` is a real state, not a gap: the payment
 * reconciler runs unattended and writes entries with no admin at all.
 */
export type AuditActorKind = 'admin' | 'system'

export type AuditRow = {
  readonly id: string
  readonly museumId: string | null
  readonly museumName: string
  readonly actor: string
  readonly actorKind: AuditActorKind
  readonly action: string
  readonly entityType: string
  readonly entityId: string
  readonly happenedAt: string
}

const ENTITY_NOUNS: Readonly<Record<string, string>> = {
  Museum: 'museum',
  Room: 'room',
  Item: 'item',
  AdminUser: 'administrator',
  Payment: 'payment',
}

const ACTION_VERBS: Readonly<Record<string, string>> = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
}

/** "Room updated", falling back to the raw pair for anything unrecognised. */
export function auditPhrase(action: string, entityType: string): string {
  const noun = ENTITY_NOUNS[entityType] ?? entityType
  const verb = ACTION_VERBS[action] ?? action.toLowerCase()
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${verb}`
}

export function auditActorLabel(kind: AuditActorKind): string {
  return kind === 'system' ? 'Automated' : 'Administrator'
}

export function auditActorTone(kind: AuditActorKind): StatusTone {
  return kind === 'system' ? 'neutral' : 'success'
}

export function toAuditRow(entry: ApiAuditLogEntry): AuditRow {
  const isSystem = entry.adminUserId === null
  return {
    id: entry.id,
    museumId: entry.museumId,
    // A deleted museum leaves its trail behind, so the name can be gone.
    museumName: entry.museumName ?? (entry.museumId === null ? 'Platform' : 'Removed museum'),
    actor: entry.adminEmail ?? 'System',
    actorKind: isSystem ? 'system' : 'admin',
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    happenedAt: entry.createdAt,
  }
}
