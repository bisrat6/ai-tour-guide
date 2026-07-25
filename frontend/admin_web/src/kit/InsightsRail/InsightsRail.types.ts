import type { ReactNode } from 'react'
import type { KpiCardProps } from '../KpiCard/KpiCard.types.ts'

/** Phase 4 — reserved shape only. */
export type InsightsRailProps = {
  readonly gauge: ReactNode
  readonly breakdown: ReactNode
  readonly kpis: readonly KpiCardProps[]
  readonly ranked: ReactNode
  readonly collapsed: boolean
}
