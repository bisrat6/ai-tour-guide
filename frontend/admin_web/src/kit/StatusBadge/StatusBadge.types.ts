import type { StatusMarker, StatusTone } from '../types.ts'

export type StatusBadgeProps = {
  readonly tone: StatusTone
  /** Always rendered. There is deliberately no prop to hide it. */
  readonly label: string
  /** Overrides the tone default only where the spec's mapping demands it. */
  readonly marker?: StatusMarker
  /** Longer explanation, e.g. "Suspended on 12 June by an operator". */
  readonly detail?: string
  readonly id?: string
}

export type StatusMarkerGlyphProps = {
  readonly marker: StatusMarker
  /** Box size in px. 12 in badges, 8 in the miniaturised spine (Phase 4). */
  readonly size?: 8 | 12 | 16
}

export const TONE_MARKER: Readonly<Record<StatusTone, StatusMarker>> = {
  success: 'dot',
  warning: 'ring',
  danger: 'cross',
  neutral: 'dash',
}
