import type { StatusMarker, StatusTone } from '../../kit/index.ts'

export type FleetStatus = 'active' | 'onboarding' | 'suspended'
export type FleetHealth = 'healthy' | 'watch' | 'critical'

export type ReadinessSegment = {
  readonly id: string
  readonly order: number
  readonly marker: StatusMarker
}

export type FleetMuseum = {
  readonly id: string
  readonly name: string
  readonly region: string
  readonly status: FleetStatus
  readonly roomCount: number
  readonly readiness: readonly ReadinessSegment[]
  readonly spendMonthlyUsd: number
  readonly health: FleetHealth
  readonly updatedAt: string
}

export const FLEET_STATUS_OPTIONS: readonly { value: FleetStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'suspended', label: 'Suspended' },
]

export function fleetStatusLabel(status: FleetStatus): string {
  if (status === 'onboarding') return 'Onboarding'
  if (status === 'suspended') return 'Suspended'
  return 'Active'
}

export function fleetStatusTone(status: FleetStatus): StatusTone {
  if (status === 'onboarding') return 'warning'
  if (status === 'suspended') return 'danger'
  return 'success'
}

export function fleetHealthLabel(health: FleetHealth): string {
  if (health === 'watch') return 'Watch'
  if (health === 'critical') return 'Critical'
  return 'Healthy'
}

export function fleetHealthTone(health: FleetHealth): StatusTone {
  if (health === 'watch') return 'warning'
  if (health === 'critical') return 'danger'
  return 'success'
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    value,
  )
}

function markersFor(idPrefix: string, markers: readonly StatusMarker[]): readonly ReadinessSegment[] {
  return markers.map((marker, index) => ({
    id: `${idPrefix}-${index + 1}`,
    order: index + 1,
    marker,
  }))
}

export const FLEET_FIXTURES: readonly FleetMuseum[] = [
  {
    id: 'adwa-victory-memorial',
    name: 'Adwa Victory Memorial',
    region: 'Addis Ababa',
    status: 'active',
    roomCount: 8,
    readiness: markersFor('adwa', ['dot', 'dot', 'dot', 'dot', 'ring', 'dot', 'dash', 'dot']),
    spendMonthlyUsd: 1240,
    health: 'healthy',
    updatedAt: '2h ago',
  },
  {
    id: 'entoto-heritage-museum',
    name: 'Entoto Heritage Museum',
    region: 'Addis Ababa',
    status: 'active',
    roomCount: 11,
    readiness: markersFor('entoto', ['dot', 'dot', 'dot', 'dot', 'dot', 'ring', 'dot', 'dot', 'dot', 'dash', 'dot']),
    spendMonthlyUsd: 1610,
    health: 'watch',
    updatedAt: '32m ago',
  },
  {
    id: 'harar-cultural-museum',
    name: 'Harar Cultural Museum',
    region: 'Harar',
    status: 'suspended',
    roomCount: 6,
    readiness: markersFor('harar', ['dash', 'dash', 'dash', 'dash', 'dash', 'dash']),
    spendMonthlyUsd: 280,
    health: 'critical',
    updatedAt: '5d ago',
  },
  {
    id: 'sheger-modern-museum',
    name: 'Sheger Modern Museum',
    region: 'Addis Ababa',
    status: 'onboarding',
    roomCount: 4,
    readiness: markersFor('sheger', ['ring', 'dash', 'dash', 'dash']),
    spendMonthlyUsd: 420,
    health: 'watch',
    updatedAt: '7h ago',
  },
  {
    id: 'axum-obelisk-gallery',
    name: 'Axum Obelisk Gallery',
    region: 'Tigray',
    status: 'active',
    roomCount: 7,
    readiness: markersFor('axum', ['dot', 'dot', 'dot', 'ring', 'dot', 'dot', 'dot']),
    spendMonthlyUsd: 980,
    health: 'healthy',
    updatedAt: '1d ago',
  },
  {
    id: 'gondar-palace-archives',
    name: 'Gondar Palace Archives',
    region: 'Amhara',
    status: 'active',
    roomCount: 9,
    readiness: markersFor('gondar', ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'ring', 'dot', 'dot']),
    spendMonthlyUsd: 1090,
    health: 'healthy',
    updatedAt: '4h ago',
  },
  {
    id: 'lalibela-sacred-museum',
    name: 'Lalibela Sacred Museum',
    region: 'Amhara',
    status: 'active',
    roomCount: 5,
    readiness: markersFor('lalibela', ['dot', 'dot', 'ring', 'dot', 'dot']),
    spendMonthlyUsd: 870,
    health: 'watch',
    updatedAt: '14h ago',
  },
  {
    id: 'bahir-dar-lake-museum',
    name: 'Bahir Dar Lake Museum',
    region: 'Amhara',
    status: 'active',
    roomCount: 10,
    readiness: markersFor('bahir-dar', ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'ring', 'dot', 'dot']),
    spendMonthlyUsd: 1430,
    health: 'healthy',
    updatedAt: '3h ago',
  },
  {
    id: 'jimma-coffee-heritage',
    name: 'Jimma Coffee Heritage',
    region: 'Oromia',
    status: 'active',
    roomCount: 6,
    readiness: markersFor('jimma', ['dot', 'dot', 'dot', 'dot', 'ring', 'dot']),
    spendMonthlyUsd: 760,
    health: 'healthy',
    updatedAt: '9h ago',
  },
  {
    id: 'mekelle-history-center',
    name: 'Mekelle History Center',
    region: 'Tigray',
    status: 'active',
    roomCount: 8,
    readiness: markersFor('mekelle', ['dot', 'dot', 'ring', 'dot', 'dot', 'cross', 'dot', 'dot']),
    spendMonthlyUsd: 1120,
    health: 'critical',
    updatedAt: '56m ago',
  },
  {
    id: 'arbaminch-rift-gallery',
    name: 'Arba Minch Rift Gallery',
    region: 'SNNPR',
    status: 'onboarding',
    roomCount: 3,
    readiness: markersFor('arbaminch', ['ring', 'dash', 'dash']),
    spendMonthlyUsd: 210,
    health: 'watch',
    updatedAt: '6h ago',
  },
  {
    id: 'dire-dawa-rail-museum',
    name: 'Dire Dawa Rail Museum',
    region: 'Dire Dawa',
    status: 'active',
    roomCount: 7,
    readiness: markersFor('dire-dawa', ['dot', 'dot', 'dot', 'dot', 'dot', 'ring', 'dot']),
    spendMonthlyUsd: 940,
    health: 'healthy',
    updatedAt: '18h ago',
  },
]
