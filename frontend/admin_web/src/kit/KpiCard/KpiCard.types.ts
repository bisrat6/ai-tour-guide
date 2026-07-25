import type { KitState, Provenance, StatusTone } from '../types.ts'

export type KpiDelta = {
  readonly direction: 'up' | 'down' | 'flat'
  /** Pre-formatted, e.g. "+12% vs last month". */
  readonly label: string
  /** Which direction is good is domain knowledge, so the caller says. */
  readonly tone?: StatusTone
}

export type KpiCardProps = {
  readonly label: string
  /**
   * Pre-formatted for display; the kit never formats numbers or currency.
   * null renders the em-dash shell — never a fabricated value.
   */
  readonly value: string | null
  readonly unit?: string
  readonly caption?: string
  readonly delta?: KpiDelta
  /** Required. Section 10: every figure says where it came from. */
  readonly provenance: Provenance
  readonly provenanceNote?: string
  readonly state?: KitState
}

export type ProvenanceTagProps = {
  readonly provenance: Provenance
  readonly note?: string
}
