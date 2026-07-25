import type { StatusTone } from '../../kit/types.ts'

export type RoomFixture = {
  readonly id: string
  readonly order: number
  readonly title: string
  readonly itemCount: number
  readonly narrationStatus: StatusTone
  readonly updatedAt: string
}

/** Gallery-only rooms table fixture: 7 rows, four narration tones, two pages at pageSize 5. */
export const ROOMS = [
  {
    id: 'room-adwa-battle',
    order: 1,
    title: 'The Battle of Adwa',
    itemCount: 14,
    narrationStatus: 'success',
    updatedAt: '2026-07-18T09:12:00.000Z',
  },
  {
    id: 'room-road-to-adwa',
    order: 2,
    title: 'The Road to Adwa',
    itemCount: 11,
    narrationStatus: 'warning',
    updatedAt: '2026-07-17T14:40:00.000Z',
  },
  {
    id: 'room-emperor-menelik',
    order: 3,
    title: 'Emperor Menelik II',
    itemCount: 9,
    narrationStatus: 'danger',
    updatedAt: '2026-07-16T11:05:00.000Z',
  },
  {
    id: 'room-italian-invasion',
    order: 4,
    title: 'The Italian Invasion',
    itemCount: 8,
    narrationStatus: 'neutral',
    updatedAt: '2026-07-15T16:22:00.000Z',
  },
  {
    id: 'room-victory-aftermath',
    order: 5,
    title: 'Victory and Aftermath',
    itemCount: 12,
    narrationStatus: 'success',
    updatedAt: '2026-07-14T08:30:00.000Z',
  },
  {
    id: 'room-ethiopian-army',
    order: 6,
    title: 'The Ethiopian Army',
    itemCount: 10,
    narrationStatus: 'warning',
    updatedAt: '2026-07-13T13:18:00.000Z',
  },
  {
    id: 'room-museum-legacy',
    order: 7,
    title: 'Legacy of the Memorial',
    itemCount: 6,
    narrationStatus: 'neutral',
    updatedAt: '2026-07-12T10:00:00.000Z',
  },
] as const satisfies readonly RoomFixture[]
