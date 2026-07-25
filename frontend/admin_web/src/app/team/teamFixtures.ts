export type TeamMember = {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: 'MUSEUM_ADMIN' | 'CURATOR' | 'EDITOR'
  readonly accessSummary: string
  readonly lastActive: string
}

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    id: 'tm-aster',
    name: 'Aster Melesse',
    email: 'aster@adwa.local',
    role: 'MUSEUM_ADMIN',
    accessSummary: 'Museum settings, rooms, items, narration, team, activity',
    lastActive: 'Today, 14:40',
  },
  {
    id: 'tm-dawit',
    name: 'Dawit Gebru',
    email: 'dawit.curator@adwa.local',
    role: 'CURATOR',
    accessSummary: 'Rooms, items, narration scripts',
    lastActive: 'Today, 10:12',
  },
  {
    id: 'tm-selam',
    name: 'Selam Tadesse',
    email: 'selam.editor@adwa.local',
    role: 'EDITOR',
    accessSummary: 'Item metadata and media updates',
    lastActive: 'Yesterday, 16:55',
  },
] as const
