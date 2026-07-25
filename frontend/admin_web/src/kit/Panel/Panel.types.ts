import type { ReactNode } from 'react'
import type { StateAction } from '../types.ts'

export type PanelProps = {
  readonly title?: string
  readonly description?: string
  readonly actions?: ReactNode
  readonly padded?: boolean
  readonly children: ReactNode
}

export type IntegrationPendingPanelProps = {
  /** The missing dependency, in the user's words: "the visit reporting API". */
  readonly dependency: string
  /** What is missing and why, one or two sentences. */
  readonly body: string
  /** What still works. Section 7: name what remains usable. */
  readonly stillUsable?: string
  readonly action?: StateAction
  /** Inline sits within a card; region replaces a whole content area. */
  readonly variant?: 'inline' | 'region'
}
