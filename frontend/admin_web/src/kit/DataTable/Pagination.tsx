import type { ReactElement } from 'react'

import { Button } from '../Button/Button.tsx'
import { Skeleton } from '../State/Skeleton.tsx'
import type { PaginationProps } from './DataTable.types.ts'
import styles from './DataTable.module.css'

export type TablePaginationRenderProps = PaginationProps & {
  readonly loading?: boolean
}

function pageCountFor(total: number, pageSize: number): number {
  if (total === 0) return 1
  return Math.ceil(total / pageSize)
}

function rangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `${start}–${end} of ${total}`
}

/** Previous/Next controls with a polite live page announcement. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
}: TablePaginationRenderProps): ReactElement {
  const pageCount = pageCountFor(total, pageSize)

  if (loading) {
    return (
      <nav aria-label="Table pages" className={styles.pagination} aria-busy="true">
        <Skeleton region="pagination summary" shape="text" width="6rem" />
        <div className={styles.paginationControls}>
          <Button tone="secondary" disabled>
            Previous
          </Button>
          <Button tone="secondary" disabled>
            Next
          </Button>
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label="Table pages" className={styles.pagination}>
      <p className={`${styles.paginationSummary} text-caption`}>
        {rangeLabel(page, pageSize, total)}
      </p>
      <div className={styles.paginationControls}>
        <Button
          tone="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className={`${styles.pageLive} text-caption`} aria-live="polite">
          Page {page} of {pageCount}
        </span>
        <Button
          tone="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
