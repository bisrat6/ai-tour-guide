import type { StatusMarker, StatusTone } from '../../kit/index.ts'
import { FLEET_FIXTURES, formatUsd, type FleetStatus } from './fleetFixtures.ts'

export type AdapterState = 'healthy' | 'degraded' | 'retrying' | 'breaker_open'
export type PressureLevel = 'low' | 'elevated' | 'high' | 'saturated'

export type ProviderHealthRecord = {
  readonly id: string
  readonly adapter: string
  readonly provider: string
  readonly state: AdapterState
  readonly pressure: PressureLevel
  readonly note: string
  readonly updatedAt: string
}

export type SpendWindow = '7d' | '30d' | '90d'
export type SpendStatusFilter = 'all' | 'active' | 'onboarding' | 'suspended'

export type SpendRecord = {
  readonly tenantId: string
  readonly tenantName: string
  readonly region: string
  readonly status: FleetStatus
  readonly spendByWindow: Readonly<Record<SpendWindow, number>>
}

export type AuditAction =
  | 'room_updated'
  | 'item_updated'
  | 'settings_changed'
  | 'tenant_status_changed'
  | 'seat_updated'

export type AuditEntry = {
  readonly id: string
  readonly tenantId: string
  readonly tenantName: string
  readonly actor: string
  readonly action: AuditAction
  readonly detail: string
  readonly target: string
  readonly happenedAt: string
  readonly source: 'scoped_operator_write' | 'tenant_admin_write' | 'operator_control_write'
}

export type AdminStatus = 'active' | 'suspended'
export type SeatStatus = 'active' | 'invited' | 'suspended'

export type OperatorAdminAccount = {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly status: AdminStatus
  readonly lastSeen: string
}

export type MuseumAdminSeat = {
  readonly id: string
  readonly tenantId: string
  readonly tenantName: string
  readonly personName: string
  readonly email: string
  readonly status: SeatStatus
  readonly updatedAt: string
}

export const PROVIDER_HEALTH_FIXTURES: readonly ProviderHealthRecord[] = [
  {
    id: 'health-llm',
    adapter: 'Language model adapter',
    provider: 'OpenAI',
    state: 'healthy',
    pressure: 'elevated',
    note: 'Latency remains within SLO and retry queue is empty.',
    updatedAt: '2026-07-25 16:11',
  },
  {
    id: 'health-tts',
    adapter: 'Speech synthesis adapter',
    provider: 'Azure Speech',
    state: 'degraded',
    pressure: 'high',
    note: 'P95 latency increased after upstream region failover.',
    updatedAt: '2026-07-25 16:06',
  },
  {
    id: 'health-storage',
    adapter: 'Media storage adapter',
    provider: 'S3-compatible gateway',
    state: 'retrying',
    pressure: 'elevated',
    note: 'Transient write timeouts are being retried with backoff.',
    updatedAt: '2026-07-25 16:12',
  },
  {
    id: 'health-translate',
    adapter: 'Translation adapter',
    provider: 'Fallback translator',
    state: 'breaker_open',
    pressure: 'saturated',
    note: 'Circuit breaker is open after consecutive timeout threshold.',
    updatedAt: '2026-07-25 15:58',
  },
]

const spendMultiplier: Readonly<Record<SpendWindow, number>> = {
  '7d': 0.24,
  '30d': 1,
  '90d': 2.78,
}

export const SPEND_FIXTURES: readonly SpendRecord[] = FLEET_FIXTURES.map((museum) => {
  const monthly = museum.spendMonthlyUsd
  const round = (value: number): number => Math.round(value)
  return {
    tenantId: museum.id,
    tenantName: museum.name,
    region: museum.region,
    status: museum.status,
    spendByWindow: {
      '7d': round(monthly * spendMultiplier['7d']),
      '30d': round(monthly * spendMultiplier['30d']),
      '90d': round(monthly * spendMultiplier['90d']),
    },
  }
})

export const AUDIT_FIXTURES: readonly AuditEntry[] = [
  {
    id: 'audit-001',
    tenantId: 'adwa-victory-memorial',
    tenantName: 'Adwa Victory Memorial',
    actor: 'operator@adwa.local',
    action: 'item_updated',
    detail: 'Edited item grounding detail (scoped support)',
    target: 'Formation Sketch',
    happenedAt: '2026-07-25 13:08',
    source: 'scoped_operator_write',
  },
  {
    id: 'audit-002',
    tenantId: 'adwa-victory-memorial',
    tenantName: 'Adwa Victory Memorial',
    actor: 'operator@adwa.local',
    action: 'item_updated',
    detail: 'Uploaded item image URL (scoped support)',
    target: 'Supply Ledger',
    happenedAt: '2026-07-24 16:51',
    source: 'scoped_operator_write',
  },
  {
    id: 'audit-003',
    tenantId: 'entoto-heritage-museum',
    tenantName: 'Entoto Heritage Museum',
    actor: 'curator@entoto.local',
    action: 'room_updated',
    detail: 'Updated room sequence and overview text',
    target: 'Room 3 - Imperial Court',
    happenedAt: '2026-07-25 12:43',
    source: 'tenant_admin_write',
  },
  {
    id: 'audit-004',
    tenantId: 'harar-cultural-museum',
    tenantName: 'Harar Cultural Museum',
    actor: 'operator@adwa.local',
    action: 'tenant_status_changed',
    detail: 'Suspended tenant after policy review',
    target: 'Tenant status',
    happenedAt: '2026-07-23 09:12',
    source: 'operator_control_write',
  },
  {
    id: 'audit-005',
    tenantId: 'sheger-modern-museum',
    tenantName: 'Sheger Modern Museum',
    actor: 'operator@adwa.local',
    action: 'seat_updated',
    detail: 'Reactivated museum admin seat',
    target: 'Seat: samrawit@sheger.local',
    happenedAt: '2026-07-22 14:10',
    source: 'operator_control_write',
  },
  {
    id: 'audit-006',
    tenantId: 'lalibela-sacred-museum',
    tenantName: 'Lalibela Sacred Museum',
    actor: 'admin@lalibela.local',
    action: 'settings_changed',
    detail: 'Changed default narration voice',
    target: 'Settings - Voice',
    happenedAt: '2026-07-25 10:22',
    source: 'tenant_admin_write',
  },
]

export const OPERATOR_ADMIN_FIXTURES: readonly OperatorAdminAccount[] = [
  {
    id: 'op-001',
    name: 'Meron Tesfaye',
    email: 'meron@adwa.local',
    status: 'active',
    lastSeen: '2026-07-25 15:59',
  },
  {
    id: 'op-002',
    name: 'Yonas Kebede',
    email: 'yonas@adwa.local',
    status: 'active',
    lastSeen: '2026-07-25 12:08',
  },
  {
    id: 'op-003',
    name: 'Rahel Girmay',
    email: 'rahel@adwa.local',
    status: 'suspended',
    lastSeen: '2026-07-21 09:34',
  },
]

export const MUSEUM_ADMIN_SEAT_FIXTURES: readonly MuseumAdminSeat[] = [
  {
    id: 'seat-001',
    tenantId: 'adwa-victory-memorial',
    tenantName: 'Adwa Victory Memorial',
    personName: 'Aster Melesse',
    email: 'aster@adwa.local',
    status: 'active',
    updatedAt: '2026-07-25 11:18',
  },
  {
    id: 'seat-002',
    tenantId: 'entoto-heritage-museum',
    tenantName: 'Entoto Heritage Museum',
    personName: 'Hana Desta',
    email: 'hana@entoto.local',
    status: 'invited',
    updatedAt: '2026-07-24 10:41',
  },
  {
    id: 'seat-003',
    tenantId: 'harar-cultural-museum',
    tenantName: 'Harar Cultural Museum',
    personName: 'Nuru Ahmed',
    email: 'nuru@harar.local',
    status: 'suspended',
    updatedAt: '2026-07-23 17:06',
  },
]

export const SPEND_WINDOW_OPTIONS: readonly { value: SpendWindow; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export const SPEND_STATUS_OPTIONS: readonly { value: SpendStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'suspended', label: 'Suspended' },
]

export const AUDIT_ACTION_OPTIONS: readonly { value: AuditAction | 'all'; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'room_updated', label: 'Room updated' },
  { value: 'item_updated', label: 'Item updated' },
  { value: 'settings_changed', label: 'Settings changed' },
  { value: 'tenant_status_changed', label: 'Tenant status changed' },
  { value: 'seat_updated', label: 'Seat updated' },
]

export const AUDIT_WINDOW_OPTIONS: readonly { value: '24h' | '7d' | '30d' | 'all'; label: string }[] = [
  { value: '24h', label: 'Past 24 hours' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
  { value: 'all', label: 'All time' },
]

export function adapterStateLabel(state: AdapterState): string {
  if (state === 'degraded') return 'Degraded'
  if (state === 'retrying') return 'Retrying'
  if (state === 'breaker_open') return 'Breaker open'
  return 'Healthy'
}

export function adapterStateTone(state: AdapterState): StatusTone {
  if (state === 'breaker_open') return 'danger'
  if (state === 'retrying' || state === 'degraded') return 'warning'
  return 'success'
}

export function adapterStateMarker(state: AdapterState): StatusMarker {
  if (state === 'breaker_open') return 'cross'
  if (state === 'retrying' || state === 'degraded') return 'ring'
  return 'dot'
}

export function pressureLabel(pressure: PressureLevel): string {
  if (pressure === 'elevated') return 'Elevated'
  if (pressure === 'high') return 'High'
  if (pressure === 'saturated') return 'Saturated'
  return 'Low'
}

export function pressureTone(pressure: PressureLevel): StatusTone {
  if (pressure === 'saturated') return 'danger'
  if (pressure === 'high' || pressure === 'elevated') return 'warning'
  return 'success'
}

export function pressureMarker(pressure: PressureLevel): StatusMarker {
  if (pressure === 'saturated') return 'cross'
  if (pressure === 'high' || pressure === 'elevated') return 'ring'
  return 'dot'
}

export function auditActionLabel(action: AuditAction): string {
  if (action === 'room_updated') return 'Room updated'
  if (action === 'item_updated') return 'Item updated'
  if (action === 'settings_changed') return 'Settings changed'
  if (action === 'tenant_status_changed') return 'Tenant status changed'
  return 'Seat updated'
}

export function auditSourceLabel(source: AuditEntry['source']): string {
  if (source === 'scoped_operator_write') return 'Operator scoped write'
  if (source === 'operator_control_write') return 'Operator control write'
  return 'Museum admin write'
}

export function auditSourceTone(source: AuditEntry['source']): StatusTone {
  if (source === 'scoped_operator_write') return 'warning'
  if (source === 'operator_control_write') return 'neutral'
  return 'success'
}

export function adminStatusLabel(status: AdminStatus): string {
  return status === 'active' ? 'Active' : 'Suspended'
}

export function adminStatusTone(status: AdminStatus): StatusTone {
  return status === 'active' ? 'success' : 'danger'
}

export function seatStatusLabel(status: SeatStatus): string {
  if (status === 'invited') return 'Invited'
  if (status === 'suspended') return 'Suspended'
  return 'Active'
}

export function seatStatusTone(status: SeatStatus): StatusTone {
  if (status === 'invited') return 'warning'
  if (status === 'suspended') return 'danger'
  return 'success'
}

export function spendForWindow(row: SpendRecord, window: SpendWindow): number {
  return row.spendByWindow[window]
}

export function totalSpend(rows: readonly SpendRecord[], window: SpendWindow): number {
  return rows.reduce((sum, row) => sum + spendForWindow(row, window), 0)
}

export function formatSpend(value: number): string {
  return formatUsd(value)
}
