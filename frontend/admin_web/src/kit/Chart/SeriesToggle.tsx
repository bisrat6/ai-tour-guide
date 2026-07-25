import type { ReactElement } from 'react'

import type { ChartSeries } from './Chart.types.ts'
import type { SeriesToggleProps } from './Chart.types.ts'
import styles from './Chart.module.css'

function seriesColor(role: ChartSeries['role'], colors: { primary: string; comparison: string }): string {
  return role === 'primary' ? colors.primary : colors.comparison
}

type SeriesToggleColors = {
  readonly primary: string
  readonly comparison: string
}

/** Ghost button group for toggling chart series visibility. */
export function SeriesToggle({
  series,
  hiddenSeriesIds,
  onToggle,
  colors,
}: SeriesToggleProps & { readonly colors: SeriesToggleColors }): ReactElement {
  const visibleCount = series.length - hiddenSeriesIds.length

  return (
    <div className={styles.seriesToggle} role="group" aria-label="Chart series">
      {series.map((entry) => {
        const visible = !hiddenSeriesIds.includes(entry.id)
        const isLastVisible = visible && visibleCount <= 1

        return (
          <button
            key={entry.id}
            type="button"
            className={
              visible
                ? `${styles.seriesButton} ${styles.seriesButtonPressed} text-caption`
                : `${styles.seriesButton} text-caption`
            }
            aria-pressed={visible}
            {...(isLastVisible
              ? { 'aria-disabled': true as const, 'aria-describedby': `series-${entry.id}-reason` }
              : {})}
            onClick={() => {
              if (isLastVisible) return
              onToggle(entry.id, !visible)
            }}
          >
            <span
              className={styles.swatch}
              style={{ backgroundColor: seriesColor(entry.role, colors) }}
              aria-hidden="true"
            />
            {entry.label}
            {isLastVisible ? (
              <span id={`series-${entry.id}-reason`} className="visually-hidden">
                Keep at least one series visible.
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
