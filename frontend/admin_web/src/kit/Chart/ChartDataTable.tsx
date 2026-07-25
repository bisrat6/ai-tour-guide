import type { ReactElement } from 'react'

import { SR_ONLY_CLASS } from '../internal/srOnly.ts'
import type { ChartDataTableProps } from './Chart.types.ts'
import styles from './Chart.module.css'

/** Accessible fallback table — always in the DOM, visually hidden until promoted. */
export function ChartDataTable({
  id,
  caption,
  categories,
  series,
  valueFormat,
  visible,
}: ChartDataTableProps): ReactElement {
  const visibilityClass = visible ? styles.dataTableVisible : SR_ONLY_CLASS

  return (
    <table id={id} className={`${styles.dataTable} ${visibilityClass}`}>
      <caption className="text-caption">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="column-header">
            Category
          </th>
          {series.map((entry) => (
            <th key={entry.id} scope="col" className="column-header">
              {entry.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((category, rowIndex) => (
          <tr key={category}>
            <th scope="row" className="text-body">
              {category}
            </th>
            {series.map((entry) => (
              <td key={entry.id} className="text-body numeric">
                {valueFormat(entry.values[rowIndex] ?? 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
