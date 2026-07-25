import type { ReactNode, RefObject } from 'react'
import type { KitState, StatusTone } from '../types.ts'

export type PeekTab = {
  readonly id: string
  readonly label: string
  readonly count?: number
  readonly content: ReactNode
}

export type PeekPanelProps = {
  readonly open: boolean
  readonly title: string
  /**
   * When the record is a museum. Rendered through the .museum-name utility —
   * the panel never declares a font-family.
   */
  readonly museumName?: string
  readonly subtitle?: ReactNode
  readonly status?: { readonly tone: StatusTone; readonly label: string }
  readonly tabs: readonly PeekTab[]
  readonly activeTabId: string
  readonly onTabChange: (id: string) => void
  readonly footer?: ReactNode
  readonly onClose: () => void
  /**
   * The control that opened the panel — the originating row's Open button.
   * Focus returns here on close. Required: the spec names this behaviour.
   */
  readonly returnFocusTo: RefObject<HTMLElement | null>
  /**
   * 'overlay' (>=1024px) is non-modal: Tab can leave, the table stays usable.
   * 'sheet' (<1024px) is modal: focus trapped, scrim, Escape closes.
   */
  readonly variant?: 'overlay' | 'sheet'
  readonly state?: KitState
  readonly width?: 'md' | 'lg'
}
