import { useId, type ReactElement } from 'react'

import { Field } from '../Field/Field.tsx'
import { TextInput } from '../Field/TextInput.tsx'
import { Skeleton } from '../State/Skeleton.tsx'
import type { TableToolbarProps } from './DataTable.types.ts'
import styles from './DataTable.module.css'

export type TableToolbarRenderProps = TableToolbarProps & {
  readonly loading?: boolean
}

function SearchIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Search field, filter slot, actions, and optional result summary above the table. */
export function TableToolbar({
  searchValue,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filters,
  actions,
  resultSummary,
  loading = false,
}: TableToolbarRenderProps): ReactElement {
  const searchId = useId()

  if (loading) {
    return (
      <div className={styles.toolbar} aria-busy="true">
        <div className={styles.toolbarSearch}>
          <Skeleton region="search" shape="line" height="var(--target-min)" />
        </div>
        <div className={styles.toolbarFilters}>
          <Skeleton region="filters" shape="pill" width="8rem" height="var(--target-min)" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarSearch}>
        <Field id={searchId} label={searchLabel}>
          {(control) => (
            <TextInput
              {...control}
              value={searchValue}
              onChange={onSearchChange}
              {...(searchPlaceholder !== undefined ? { placeholder: searchPlaceholder } : {})}
              leadingIcon={<SearchIcon />}
              clearable={searchValue.length > 0}
              clearLabel="Clear search"
            />
          )}
        </Field>
      </div>
      {filters !== undefined ? <div className={styles.toolbarFilters}>{filters}</div> : null}
      {actions !== undefined ? <div className={styles.toolbarActions}>{actions}</div> : null}
      {resultSummary !== undefined ? (
        <p className={`${styles.toolbarSummary} text-caption`}>{resultSummary}</p>
      ) : null}
    </div>
  )
}
