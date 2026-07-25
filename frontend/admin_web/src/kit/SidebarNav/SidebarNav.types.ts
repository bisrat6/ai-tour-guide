import type { ReactNode } from 'react'

export type NavItem = {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  readonly count?: number
  readonly href: string
}

/** Phase 3 — reserved shape only. */
export type SidebarNavProps = {
  readonly items: readonly NavItem[]
  readonly activeId: string
  readonly collapsed: boolean
  readonly onCollapsedChange: (next: boolean) => void
  readonly search: ReactNode
  readonly secondary: readonly NavItem[]
  readonly account: ReactNode
}
