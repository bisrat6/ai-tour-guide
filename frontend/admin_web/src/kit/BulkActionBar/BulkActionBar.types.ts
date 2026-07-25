import type { KitState } from '../types.ts'

export type BulkAction = {
  readonly id: string
  readonly label: string
  readonly tone?: 'secondary' | 'danger'
  readonly disabled?: boolean
  readonly disabledReason?: string
  /** Destructive actions route through ConfirmDialog before onAct fires. */
  readonly confirm?: {
    readonly title: string
    readonly consequence: string
    readonly confirmLabel: string
  }
  readonly onAct: (selectedKeys: ReadonlySet<string>) => void
}

export type BulkActionBarProps = {
  readonly selectedKeys: ReadonlySet<string>
  /** Singular and plural noun: { one: 'museum', many: 'museums' }. */
  readonly noun: { readonly one: string; readonly many: string }
  readonly actions: readonly BulkAction[]
  readonly onClear: () => void
  /** 'float' above content, 'dock' to the bottom edge below 768px. */
  readonly anchor?: 'float' | 'dock'
  readonly state?: Extract<KitState, { kind: 'ready' | 'loading' | 'failure' }>
}
