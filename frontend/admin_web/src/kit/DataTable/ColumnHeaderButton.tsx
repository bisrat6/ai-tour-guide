import type { ReactElement } from 'react'

import type { SortDirection } from './DataTable.types.ts'
import styles from './DataTable.module.css'

export type ColumnHeaderButtonProps = {
  readonly header: string
  readonly sortable?: boolean
  readonly sortDirection: SortDirection | 'none'
  readonly onToggleSort: () => void
  readonly numeric?: boolean
}

function sortAnnouncement(direction: SortDirection | 'none'): string {
  if (direction === 'ascending') return 'sorted ascending'
  if (direction === 'descending') return 'sorted descending'
  return 'not sorted'
}

function sortActivateHint(direction: SortDirection | 'none'): string {
  if (direction === 'ascending') return 'Activate to sort descending.'
  if (direction === 'descending') return 'Activate to clear sort.'
  return 'Activate to sort ascending.'
}

function SortGlyph({ direction }: { readonly direction: SortDirection | 'none' }): ReactElement {
  if (direction === 'ascending') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path
          d="M6 2.5 9.5 7h-7L6 2.5Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (direction === 'descending') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path
          d="M6 9.5 2.5 5h7L6 9.5Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M6 1.5 8.5 4.5h-5L6 1.5ZM6 10.5 3.5 7.5h5L6 10.5Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  )
}

/** Full-width sort control rendered inside a `<th aria-sort>`. */
export function ColumnHeaderButton({
  header,
  sortable = false,
  sortDirection,
  onToggleSort,
  numeric = false,
}: ColumnHeaderButtonProps): ReactElement {
  if (!sortable) {
    return (
      <span className={`column-header${numeric ? ' numeric' : ''}`}>{header}</span>
    )
  }

  const label = `${header}, ${sortAnnouncement(sortDirection)}. ${sortActivateHint(sortDirection)}`
  const iconClass =
    sortDirection === 'none'
      ? styles.sortIcon
      : `${styles.sortIcon} ${styles.sortIconActive}`

  return (
    <button
      type="button"
      className={`${styles.sortButton} column-header${numeric ? ' numeric' : ''}`}
      aria-label={label}
      onClick={onToggleSort}
    >
      <span>{header}</span>
      <span className={iconClass}>
        <SortGlyph direction={sortDirection} />
      </span>
    </button>
  )
}
