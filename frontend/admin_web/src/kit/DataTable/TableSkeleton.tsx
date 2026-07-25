import type { ReactElement } from 'react'

import { Skeleton } from '../State/Skeleton.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { Column } from './DataTable.types.ts'
import styles from './DataTable.module.css'

export type TableSkeletonProps<Row> = {
  readonly columns: readonly Column<Row>[]
  readonly skeletonRows: number
  readonly hasSelection: boolean
  readonly hasActions: boolean
  readonly label: string
}

function hideBelowClass(hideBelow: 768 | 1024 | 1280 | undefined): string {
  if (hideBelow === 768) return styles.hideBelow768
  if (hideBelow === 1024) return styles.hideBelow1024
  if (hideBelow === 1280) return styles.hideBelow1280
  return ''
}

/** Named skeleton body rows while column headers stay rendered. */
export function TableSkeletonRows<Row>({
  columns,
  skeletonRows,
  hasSelection,
  hasActions,
  label,
}: TableSkeletonProps<Row>): ReactElement {
  return (
    <>
      <VisuallyHidden>Loading {label}</VisuallyHidden>
      {Array.from({ length: skeletonRows }, (_, rowIndex) => (
        <tr key={`skeleton-${rowIndex}`} className={styles.row}>
          {hasSelection ? (
            <td className={styles.selectCell}>
              <Skeleton region={`row ${rowIndex + 1} select`} shape="circle" width="1rem" height="1rem" />
            </td>
          ) : null}
          {columns.map((column) => (
            <td
              key={column.id}
              className={[
                column.numeric === true ? `${styles.cellNumeric} numeric` : '',
                hideBelowClass(column.hideBelow),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.skeletonCell}>
                <Skeleton
                  region={`${column.header} row ${rowIndex + 1}`}
                  shape="text"
                  width={column.width ?? '70%'}
                />
              </span>
            </td>
          ))}
          {hasActions ? (
            <td>
              <Skeleton region={`actions row ${rowIndex + 1}`} shape="text" width="3rem" />
            </td>
          ) : null}
        </tr>
      ))}
    </>
  )
}
