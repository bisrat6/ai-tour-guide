import type { ReactNode } from 'react'

export type TabItem = {
  readonly id: string
  readonly label: string
  /** Count badge, e.g. unanswered questions. Omit for zero. */
  readonly count?: number
  readonly disabled?: boolean
  readonly disabledReason?: string
}

export type TabsProps = {
  /** Accessible name for the tablist, e.g. "Room details". */
  readonly label: string
  readonly items: readonly TabItem[]
  readonly activeId: string
  readonly onChange: (id: string) => void
  /**
   * 'automatic' switches on arrow key. 'manual' requires Enter or Space.
   * Default 'automatic'; use 'manual' when a panel triggers a fetch.
   */
  readonly activation?: 'automatic' | 'manual'
  /** Prefix for the generated tab/panel id pair. Defaults to useId(). */
  readonly idPrefix?: string
  readonly variant?: 'underline' | 'enclosed'
  readonly children?: ReactNode
}

export type TabPanelProps = {
  readonly tabId: string
  readonly idPrefix: string
  readonly active: boolean
  readonly children: ReactNode
}
