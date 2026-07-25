import type { ReactElement } from 'react'

import type { FilterChipRowProps } from './FilterChip.types.ts'
import styles from './FilterChip.module.css'

export function FilterChipRow({
  label,
  children,
  activeCount,
  onClearAll,
  overflow,
}: FilterChipRowProps): ReactElement {
  return (
    <div role="group" aria-label={label} className={styles.row}>
      <span className={`${styles.rowLabel} text-caption`}>{label}</span>
      <div className={styles.chips}>{children}</div>
      <div className={styles.meta}>
        {activeCount > 0 ? (
          <span className={`${styles.activeCount} text-caption`}>
            {activeCount} filters applied
          </span>
        ) : null}
        {activeCount > 0 ? (
          <button type="button" className={`${styles.clearAll} text-body`} onClick={onClearAll}>
            Clear all filters
          </button>
        ) : null}
        {overflow}
      </div>
    </div>
  )
}
