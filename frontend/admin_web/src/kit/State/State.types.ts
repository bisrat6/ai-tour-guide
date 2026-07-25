import type { ReactNode } from 'react'
import type { KitState } from '../types.ts'

export type StateBlockProps = {
  /** Non-ready state to render. `ready` renders nothing. */
  readonly state: KitState
  /** Sized to the region it replaces, so layout never jumps. */
  readonly size?: 'inline' | 'region' | 'page'
  /** Named skeleton regions the loading state should draw. */
  readonly skeleton?: ReactNode
  /** Announced politely when the state changes. Default true. */
  readonly announce?: boolean
  readonly id?: string
}

export type SkeletonProps = {
  /** Names the region, e.g. "table rows". Used for the aria-busy label. */
  readonly region: string
  readonly shape?: 'text' | 'line' | 'block' | 'pill' | 'circle'
  readonly lines?: number
  readonly width?: string
  readonly height?: string
}

export type VisuallyHiddenProps = {
  readonly children: ReactNode
  readonly as?: 'span' | 'div'
  readonly id?: string
}

export type StatusMarkerGlyphProps = {
  readonly marker: import('../types.ts').StatusMarker
  /** Box size in px. 12 in badges, 8 in the miniaturised spine (Phase 4). */
  readonly size?: 8 | 12 | 16
}
