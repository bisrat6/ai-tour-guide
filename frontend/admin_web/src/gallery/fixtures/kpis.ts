import type { KpiCardProps } from '../../kit/KpiCard/KpiCard.types.ts'

export const kpiFixtures = [
  {
    label: 'Rooms ready',
    value: '14',
    provenance: 'demo',
    caption: 'Across all public galleries',
  },
  {
    label: 'Narration plays',
    value: '2,340',
    unit: '/mo',
    provenance: 'demo',
    delta: {
      direction: 'up',
      label: '+12% vs last month',
      tone: 'success',
    },
  },
  {
    label: 'Visit reporting',
    value: null,
    provenance: 'pending',
    caption: 'Requires the visit reporting API',
    state: {
      kind: 'integrationPending',
      dependency: 'the visit reporting API',
      body: 'Visit counts will appear here once reporting is connected.',
    },
  },
  {
    label: 'Uptime',
    value: '99.2',
    unit: '%',
    provenance: 'live',
  },
] as const satisfies readonly KpiCardProps[]

export const kpiStateSpecimens = [
  {
    label: 'Rooms ready',
    value: '14',
    provenance: 'demo',
    state: { kind: 'ready' },
  },
  {
    label: 'Rooms ready',
    value: '14',
    provenance: 'demo',
    state: { kind: 'loading', label: 'Rooms ready' },
  },
  {
    label: 'Rooms ready',
    value: null,
    provenance: 'demo',
    state: {
      kind: 'empty',
      title: 'No value yet',
      body: 'No rooms are marked ready in this range.',
    },
  },
  {
    label: 'Rooms ready',
    value: null,
    provenance: 'demo',
    state: {
      kind: 'failure',
      title: 'Did not load',
      body: 'The KPI request failed.',
      retry: { label: 'Try again', onAct: () => undefined },
    },
  },
  {
    label: 'Rooms ready',
    value: null,
    provenance: 'demo',
    state: {
      kind: 'unauthorized',
      title: 'Not available to your role',
      body: 'Your role cannot view room readiness.',
    },
  },
  {
    label: 'Visit reporting',
    value: null,
    provenance: 'pending',
    state: {
      kind: 'integrationPending',
      dependency: 'the visit reporting API',
      body: 'Visit counts will appear here once reporting is connected.',
    },
  },
] as const satisfies readonly KpiCardProps[]
