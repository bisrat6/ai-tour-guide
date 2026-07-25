import type { StatusTone } from '../../kit/index.ts'
import type { NarrationStatus } from '../rooms/authoringStore.tsx'

export type NarrationGroupId = 'ready' | 'needs_generation' | 'unavailable'

export type NarrationGroupConfig = {
  readonly id: NarrationGroupId
  readonly title: string
  readonly description: string
  readonly tone: StatusTone
}

export type VoiceOption = {
  readonly value: string
  readonly label: string
}

export const NARRATION_GROUPS: readonly NarrationGroupConfig[] = [
  {
    id: 'ready',
    title: 'Ready',
    description: 'Audio can be published once provider playback is connected.',
    tone: 'success',
  },
  {
    id: 'needs_generation',
    title: 'Needs generation',
    description: 'Script or generation updates are still required.',
    tone: 'warning',
  },
  {
    id: 'unavailable',
    title: 'Unavailable',
    description: 'Narration is blocked until script quality issues are resolved.',
    tone: 'danger',
  },
] as const

export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { value: 'voice-ethiopic-clarity', label: 'Ethiopic Clarity (default)' },
  { value: 'voice-heritage-guide', label: 'Heritage Guide' },
  { value: 'voice-museum-warm', label: 'Museum Warm' },
] as const

export const DEFAULT_ROOM_VOICE_BY_ID: Readonly<Record<string, string>> = {
  'r-beginning': 'voice-ethiopic-clarity',
  'r-mobilization': 'voice-heritage-guide',
  'r-battlefield': 'voice-museum-warm',
  'r-legacy': 'voice-ethiopic-clarity',
}

export function groupFromNarrationStatus(status: NarrationStatus): NarrationGroupId {
  if (status === 'ready') return 'ready'
  if (status === 'revision') return 'unavailable'
  return 'needs_generation'
}

export function labelFromNarrationStatus(status: NarrationStatus): string {
  if (status === 'ready') return 'Ready'
  if (status === 'generating') return 'Generating'
  if (status === 'revision') return 'Needs revision'
  return 'Not started'
}
