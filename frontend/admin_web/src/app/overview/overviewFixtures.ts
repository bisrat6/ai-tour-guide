import type { KpiCardProps } from '../../kit/KpiCard/KpiCard.types.ts'
import type { ChartSeries } from '../../kit/index.ts'
import type { Provenance, StatusMarker, StatusTone } from '../../kit/types.ts'

export type RoomReadiness = {
  readonly id: string
  readonly order: number
  readonly title: string
  readonly narrationLabel: string
  readonly narrationTone: StatusTone
  readonly marker: StatusMarker
  readonly updatedAt: string
  readonly completion: string
}

export type RecentChange = {
  readonly id: string
  readonly actor: string
  readonly actorRole: 'museum_admin' | 'system_operator'
  readonly action: string
  readonly target: string
  readonly when: string
  readonly provenance: Provenance
}

export type MiniKpi = {
  readonly label: string
  readonly value: string | null
  readonly provenance: Provenance
}

export type RankedRoom = {
  readonly roomId: string
  readonly label: string
  readonly value: string
  readonly provenance: Provenance
}

export const OVERVIEW_MUSEUM_NAME = 'Adwa Victory Memorial'

export const OVERVIEW_KPIS = [
  {
    label: 'Rooms with ready narration',
    value: '9',
    unit: '/ 14',
    caption: 'Ready rooms in story sequence',
    delta: { direction: 'up', label: '+2 since last editorial pass', tone: 'success' },
    provenance: 'demo',
  },
  {
    label: 'Narration generation queue',
    value: '3',
    caption: 'Rooms waiting for regenerated audio',
    delta: { direction: 'down', label: '1 fewer than yesterday', tone: 'success' },
    provenance: 'demo',
  },
  {
    label: 'Question answer success',
    value: '91%',
    caption: 'Mock verification set',
    delta: { direction: 'up', label: '+4 points this week', tone: 'success' },
    provenance: 'demo',
  },
  {
    label: 'Completion rate (ticket scans)',
    value: null,
    caption: 'Visitor telemetry backend not connected yet.',
    provenance: 'pending',
  },
] as const satisfies readonly KpiCardProps[]

export const OVERVIEW_ROOMS = [
  {
    id: 'road-to-adwa',
    order: 1,
    title: 'Road to Adwa',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 21',
    completion: '98%',
  },
  {
    id: 'voices-of-command',
    order: 2,
    title: 'Voices of Command',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 20',
    completion: '95%',
  },
  {
    id: 'march-and-supply',
    order: 3,
    title: 'March and Supply',
    narrationLabel: 'Generating',
    narrationTone: 'warning',
    marker: 'ring',
    updatedAt: 'Updated Jul 19',
    completion: '72%',
  },
  {
    id: 'battlefront',
    order: 4,
    title: 'Battlefront',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 22',
    completion: '100%',
  },
  {
    id: 'regimental-histories',
    order: 5,
    title: 'Regimental Histories',
    narrationLabel: 'Not started',
    narrationTone: 'neutral',
    marker: 'dash',
    updatedAt: 'Updated Jul 12',
    completion: '0%',
  },
  {
    id: 'foreign-correspondence',
    order: 6,
    title: 'Foreign Correspondence',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 18',
    completion: '88%',
  },
  {
    id: 'aftermath-and-legacy',
    order: 7,
    title: 'Aftermath and Legacy',
    narrationLabel: 'Needs revision',
    narrationTone: 'danger',
    marker: 'cross',
    updatedAt: 'Updated Jul 17',
    completion: '41%',
  },
  {
    id: 'global-press',
    order: 8,
    title: 'Global Press',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 19',
    completion: '93%',
  },
  {
    id: 'commander-biographies',
    order: 9,
    title: 'Commander Biographies',
    narrationLabel: 'Generating',
    narrationTone: 'warning',
    marker: 'ring',
    updatedAt: 'Updated Jul 21',
    completion: '64%',
  },
  {
    id: 'artifact-focus',
    order: 10,
    title: 'Artifact Focus',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 20',
    completion: '90%',
  },
  {
    id: 'memory-wall',
    order: 11,
    title: 'Memory Wall',
    narrationLabel: 'Not started',
    narrationTone: 'neutral',
    marker: 'dash',
    updatedAt: 'Updated Jul 10',
    completion: '0%',
  },
  {
    id: 'diaspora-voices',
    order: 12,
    title: 'Diaspora Voices',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 16',
    completion: '86%',
  },
  {
    id: 'conservation-lab',
    order: 13,
    title: 'Conservation Lab',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 22',
    completion: '97%',
  },
  {
    id: 'reflection-hall',
    order: 14,
    title: 'Reflection Hall',
    narrationLabel: 'Ready',
    narrationTone: 'success',
    marker: 'dot',
    updatedAt: 'Updated Jul 20',
    completion: '92%',
  },
] as const satisfies readonly RoomReadiness[]

export const OVERVIEW_CHART_CATEGORIES = OVERVIEW_ROOMS.map((room) => `${room.order}`)

export const VISIT_VOLUME_SERIES = [
  {
    id: 'weekday-visits',
    label: 'Weekday visits',
    role: 'primary',
    values: [182, 201, 149, 234, 96, 141, 118, 173, 127, 156, 80, 132, 104, 111],
  },
  {
    id: 'weekend-visits',
    label: 'Weekend visits',
    role: 'comparison',
    values: [231, 247, 198, 282, 122, 188, 160, 214, 169, 201, 116, 167, 138, 149],
  },
  {
    id: 'guided-groups',
    label: 'Guided groups',
    role: 'comparison',
    values: [19, 24, 16, 31, 8, 15, 11, 21, 12, 17, 5, 14, 9, 10],
  },
] as const satisfies readonly ChartSeries[]

export const ENGAGEMENT_VALUE_SERIES = [
  {
    id: 'avg-dwell-minutes',
    label: 'Avg dwell minutes',
    role: 'primary',
    values: [7.8, 8.4, 6.9, 9.1, 4.3, 6.1, 5.4, 7.2, 5.8, 6.5, 3.6, 5.1, 4.7, 5.9],
  },
  {
    id: 'completion-share',
    label: 'Completion share (%)',
    role: 'comparison',
    values: [98, 95, 72, 100, 0, 88, 41, 93, 64, 90, 0, 86, 97, 92],
  },
] as const satisfies readonly ChartSeries[]

export const OVERVIEW_RECENT_CHANGES = [
  {
    id: 'change-1',
    actor: 'Aster M.',
    actorRole: 'museum_admin',
    action: 'Published narration',
    target: 'Room 04 - Battlefront',
    when: '2 hours ago',
    provenance: 'demo',
  },
  {
    id: 'change-2',
    actor: 'operator@adwa.local',
    actorRole: 'system_operator',
    action: 'Queued regeneration (scoped support)',
    target: 'Room 09 - Commander Biographies',
    when: '5 hours ago',
    provenance: 'demo',
  },
  {
    id: 'change-3',
    actor: 'Dawit G.',
    actorRole: 'museum_admin',
    action: 'Reordered room',
    target: 'Room 06 - Foreign Correspondence',
    when: 'Yesterday',
    provenance: 'demo',
  },
  {
    id: 'change-4',
    actor: 'operator@adwa.local',
    actorRole: 'system_operator',
    action: 'Updated script (scoped support)',
    target: 'Room 07 - Aftermath and Legacy',
    when: 'Yesterday',
    provenance: 'demo',
  },
] as const satisfies readonly RecentChange[]

export const INSIGHTS_MINI_KPIS = [
  { label: 'Ready', value: '9', provenance: 'demo' },
  { label: 'Generating', value: '2', provenance: 'demo' },
  { label: 'Needs revision', value: '1', provenance: 'demo' },
  { label: 'Not started', value: '2', provenance: 'demo' },
] as const satisfies readonly MiniKpi[]

export const TOP_ROOMS_BY_VISITS = [
  { roomId: 'battlefront', label: 'Battlefront', value: '516 visits', provenance: 'demo' },
  { roomId: 'voices-of-command', label: 'Voices of Command', value: '448 visits', provenance: 'demo' },
  { roomId: 'road-to-adwa', label: 'Road to Adwa', value: '413 visits', provenance: 'demo' },
  { roomId: 'global-press', label: 'Global Press', value: '387 visits', provenance: 'demo' },
] as const satisfies readonly RankedRoom[]
