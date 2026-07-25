export type ActivityEntry = {
  readonly id: string
  readonly actor: string
  readonly actorRole: 'museum_admin' | 'system_operator'
  readonly action: string
  readonly target: string
  readonly when: string
}

export const TENANT_ACTIVITY_ENTRIES: readonly ActivityEntry[] = [
  {
    id: 'act-001',
    actor: 'Aster Melesse',
    actorRole: 'museum_admin',
    action: 'Updated narration script',
    target: 'Room 2 - Mobilization and Strategy',
    when: '2026-07-25 14:32',
  },
  {
    id: 'act-002',
    actor: 'operator@adwa.local',
    actorRole: 'system_operator',
    action: 'Edited item grounding detail (scoped support)',
    target: 'Formation Sketch',
    when: '2026-07-25 13:08',
  },
  {
    id: 'act-003',
    actor: 'Aster Melesse',
    actorRole: 'museum_admin',
    action: 'Changed default voice',
    target: 'Settings - Voice',
    when: '2026-07-25 11:47',
  },
  {
    id: 'act-004',
    actor: 'operator@adwa.local',
    actorRole: 'system_operator',
    action: 'Uploaded item image URL (scoped support)',
    target: 'Supply Ledger',
    when: '2026-07-24 16:51',
  },
] as const
