import type { PeekTab } from '../../kit/PeekPanel/PeekPanel.types.ts'

export const PEEK_TABS = [
  {
    id: 'details',
    label: 'Details',
    content: 'Room order 3 · 12 items · Narration complete.',
  },
  {
    id: 'activity',
    label: 'Activity',
    count: 2,
    content: 'Published yesterday by an operator.',
  },
  {
    id: 'notes',
    label: 'Notes',
    content: 'No notes yet.',
  },
] as const satisfies readonly PeekTab[]

export const PEEK_RECORD = {
  title: 'Room record',
  museumName: 'Harar Museum',
  subtitle: 'Updated 12 June',
  status: { tone: 'success', label: 'Published' },
} as const
