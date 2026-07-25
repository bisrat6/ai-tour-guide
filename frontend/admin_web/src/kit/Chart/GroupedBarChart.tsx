import type { ReactElement } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { Chart as ChartJS } from 'chart.js'

import { useReducedMotion } from '../internal/useReducedMotion.ts'
import { useResolvedTokens } from '../internal/useResolvedTokens.ts'
import { ProvenanceTag } from '../KpiCard/ProvenanceTag.tsx'
import { Skeleton } from '../State/Skeleton.tsx'
import { resolveState } from '../types.ts'
import { ChartDataTable } from './ChartDataTable.tsx'
import styles from './Chart.module.css'
import './chartSetup.ts'
import { CHART_TOKEN_NAMES, colorWithAlpha, parseMotionDuration } from './chartTokens.ts'
import { SeriesToggle } from './SeriesToggle.tsx'
import type { GroupedBarChartProps } from './Chart.types.ts'

const DEFAULT_HEIGHT = 240

function visibleSeries(
  series: GroupedBarChartProps['series'],
  hiddenSeriesIds: readonly string[],
): GroupedBarChartProps['series'] {
  return series.filter((entry) => !hiddenSeriesIds.includes(entry.id))
}

function ChartLoadingSkeleton({ height }: { readonly height: number }): ReactElement {
  const barHeights = ['45%', '70%', '55%', '80%', '60%', '75%']

  return (
    <div className={styles.loadingSkeleton} style={{ ['--chart-height' as string]: `${height}px` }}>
      <div className={styles.bars} aria-hidden="true">
        {barHeights.map((barHeight, index) => (
          <div key={index} className={styles.barGroup}>
            <Skeleton region={`bar ${index + 1}`} shape="block" width="40%" height={barHeight} />
            <Skeleton region={`bar ${index + 1}`} shape="block" width="40%" height="55%" />
          </div>
        ))}
      </div>
      <div className={styles.axisLine} aria-hidden="true" />
    </div>
  )
}

/** Chart.js grouped bar wrapper with token-resolved colours and accessible fallback table. */
export function GroupedBarChart({
  title,
  description,
  categories,
  series,
  valueFormat,
  axisLabel,
  provenance,
  hiddenSeriesIds = [],
  onSeriesToggle,
  state,
  height = DEFAULT_HEIGHT,
  planeKey,
}: GroupedBarChartProps): ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartJS<'bar'> | null>(null)
  const hasPainted = useRef(false)
  const reduceMotion = useReducedMotion()
  const tableId = useId()
  const [tableVisible, setTableVisible] = useState(false)

  // planeKey is a repaint trigger only — never read as a colour source.
  const tokens = useResolvedTokens(wrapperRef, CHART_TOKEN_NAMES, planeKey)
  const resolved = resolveState(state)

  const shownSeries = useMemo(
    () => visibleSeries(series, hiddenSeriesIds),
    [series, hiddenSeriesIds],
  )

  const chartData = useMemo((): ChartData<'bar'> => {
    const primary = tokens['--chart-series-primary']
    const comparison = tokens['--chart-series-comparison']

    return {
      labels: resolved.kind === 'unauthorized' ? [] : [...categories],
      datasets: shownSeries.map((entry) => ({
        label: entry.label,
        data: [...entry.values],
        backgroundColor: entry.role === 'primary' ? primary : comparison,
        hoverBackgroundColor: colorWithAlpha(
          entry.role === 'primary' ? primary : comparison,
          0.88,
        ),
        borderRadius: 0,
        borderSkipped: false,
      })),
    }
  }, [categories, shownSeries, tokens, resolved.kind])

  const animationDuration = parseMotionDuration(tokens['--motion-view'])

  const chartOptions = useMemo((): ChartOptions<'bar'> => {
    const grid = tokens['--chart-grid']
    const axisText = tokens['--chart-axis-text']
    const animation =
      reduceMotion || hasPainted.current
        ? (false as const)
        : { duration: animationDuration, easing: 'easeOutCubic' as const }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tokens['--chart-tooltip-surface'],
          titleColor: tokens['--chart-tooltip-text'],
          bodyColor: tokens['--chart-tooltip-text'],
          borderColor: tokens['--chart-tooltip-border'],
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          display: resolved.kind !== 'unauthorized',
          grid: { display: false, color: grid },
          border: { color: grid },
          ticks: { color: axisText },
          ...(axisLabel !== undefined
            ? { title: { display: true, text: axisLabel, color: axisText } }
            : {}),
        },
        y: {
          display: resolved.kind !== 'unauthorized',
          beginAtZero: true,
          grid: { color: grid },
          border: { color: grid },
          ticks: { color: axisText },
        },
      },
    }
  }, [animationDuration, axisLabel, reduceMotion, resolved.kind, tokens])

  useEffect(() => {
    hasPainted.current = true
  }, [])

  useEffect(() => {
    if (!hasPainted.current) return
    chartRef.current?.update('none')
  }, [shownSeries, hiddenSeriesIds, tokens, resolved.kind])

  const toggleLabel = tableVisible ? 'Hide data table' : 'Show data table'
  const tableSeries = resolved.kind === 'unauthorized' ? [] : shownSeries
  const tableCategories = resolved.kind === 'unauthorized' ? [] : categories

  return (
    <div ref={wrapperRef} className={styles.root}>
      <div className={styles.header}>
        <h3 className={`${styles.title} text-subtitle`}>{title}</h3>
        {resolved.kind === 'ready' || resolved.kind === 'integrationPending' ? (
          <SeriesToggle
            series={series}
            hiddenSeriesIds={hiddenSeriesIds}
            onToggle={(id, visible) => onSeriesToggle?.(id, visible)}
            colors={{
              primary: tokens['--chart-series-primary'],
              comparison: tokens['--chart-series-comparison'],
            }}
          />
        ) : null}
      </div>

      <div className={styles.chartArea} style={{ ['--chart-height' as string]: `${height}px` }}>
        {resolved.kind === 'loading' ? <ChartLoadingSkeleton height={height} /> : null}

        {resolved.kind === 'empty' ? (
          <div className={styles.stateBlock} role="status">
            <h4 className={`${styles.stateTitle} text-subtitle`}>{resolved.title}</h4>
            {resolved.body !== undefined ? (
              <p className={`${styles.stateBody} text-body`}>{resolved.body}</p>
            ) : (
              <p className={`${styles.stateBody} text-body`}>
                Widen the time window to see results.
              </p>
            )}
          </div>
        ) : null}

        {resolved.kind === 'failure' ? (
          <div className={styles.stateBlock} role="alert">
            <h4 className={`${styles.stateTitle} text-subtitle`}>{resolved.title}</h4>
            <p className={`${styles.stateBody} text-body`}>{resolved.body}</p>
            {resolved.retry !== undefined ? (
              <div className={styles.stateActions}>
                <button
                  type="button"
                  className={`${styles.actionButton} text-body`}
                  onClick={resolved.retry.onAct}
                >
                  {resolved.retry.label}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {resolved.kind === 'unauthorized' ? (
          <div className={styles.stateBlock} role="status">
            <h4 className={`${styles.stateTitle} text-subtitle`}>{resolved.title}</h4>
            <p className={`${styles.stateBody} text-body`}>{resolved.body}</p>
          </div>
        ) : null}

        {resolved.kind === 'integrationPending' ? (
          <div className={styles.integrationShell}>
            <div className={styles.canvasWrap} aria-hidden="true">
              <Bar
                ref={chartRef}
                data={{ labels: [...categories], datasets: [] }}
                options={{
                  ...chartOptions,
                  animation: false,
                }}
              />
            </div>
            <ProvenanceTag provenance="pending" />
            <p className={`${styles.integrationBody} text-body`}>{resolved.body}</p>
          </div>
        ) : null}

        {resolved.kind === 'ready' ? (
          <div
            className={styles.canvasWrap}
            role="img"
            aria-label={description}
            aria-describedby={tableId}
          >
            <Bar ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        ) : null}
      </div>

      {resolved.kind === 'ready' || resolved.kind === 'failure' ? (
        <>
          <button
            type="button"
            className={`${styles.tableToggle} text-caption`}
            aria-expanded={tableVisible}
            aria-controls={tableId}
            onClick={() => setTableVisible((current) => !current)}
          >
            {toggleLabel}
          </button>
          <ChartDataTable
            id={tableId}
            caption={`${title} data`}
            categories={tableCategories}
            series={tableSeries.length > 0 ? tableSeries : series}
            valueFormat={valueFormat}
            visible={tableVisible}
          />
        </>
      ) : null}

      {resolved.kind === 'ready' && provenance === 'demo' ? (
        <ProvenanceTag provenance="demo" />
      ) : null}
    </div>
  )
}
