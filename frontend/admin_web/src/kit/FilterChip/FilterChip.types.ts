import type { ReactNode } from 'react'
import type { KitState } from '../types.ts'

export type FilterOption = {
  readonly value: string
  readonly label: string
  readonly count?: number
}

export type FilterChipProps = {
  readonly id: string
  /** The dimension, e.g. "Status". Always visible, selected or not. */
  readonly label: string
  readonly options: readonly FilterOption[]
  readonly selected: readonly string[]
  readonly onChange: (next: readonly string[]) => void
  readonly multiple?: boolean
  /** Default: one selection shows its label, more shows "Status: 3". */
  readonly summarize?: (selected: readonly FilterOption[]) => string
  readonly disabled?: boolean
  readonly disabledReason?: string
  /** Options can load or fail independently of the page. */
  readonly state?: Extract<KitState, { kind: 'ready' | 'loading' | 'failure' }>
}

export type FilterChipRowProps = {
  /** Accessible name for the group, e.g. "Filter rooms". */
  readonly label: string
  readonly children: ReactNode
  readonly activeCount: number
  readonly onClearAll: () => void
  /** Rendered at the row end, e.g. an "All filters" overflow trigger. */
  readonly overflow?: ReactNode
}
