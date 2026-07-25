import type { ReactNode } from 'react'

/** Phase 5 — reserved shape only. */
export type EditorWorkspaceProps = {
  readonly dirty: boolean
  readonly saving: boolean
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly lastSavedLabel?: string
  readonly children: ReactNode
}
