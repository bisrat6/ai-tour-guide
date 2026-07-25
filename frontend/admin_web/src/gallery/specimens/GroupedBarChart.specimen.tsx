import type { ReactElement } from 'react'
import { useState } from 'react'

import { GroupedBarChart } from '../../kit/Chart/GroupedBarChart.tsx'
import type { GroupedBarChartProps } from '../../kit/Chart/Chart.types.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import {
  chartAxisLabel,
  chartCategories,
  chartDescription,
  chartProvenance,
  chartSeries,
  chartTitle,
  formatChartValue,
} from '../fixtures/series.ts'
import styles from '../Gallery.module.css'

const READY_PROPS = {
  title: chartTitle,
  description: chartDescription,
  categories: chartCategories,
  series: chartSeries,
  valueFormat: formatChartValue,
  axisLabel: chartAxisLabel,
  provenance: chartProvenance,
} as const satisfies Omit<GroupedBarChartProps, 'hiddenSeriesIds' | 'onSeriesToggle' | 'planeKey'>

const STATE_SPECIMENS = [
  {
    key: 'ready',
    state: { kind: 'ready' as const },
  },
  {
    key: 'loading',
    state: { kind: 'loading' as const, label: 'chart' },
  },
  {
    key: 'empty',
    state: {
      kind: 'empty' as const,
      title: 'No data for this range',
      body: 'Widen the time window to see results.',
    },
  },
  {
    key: 'failure',
    state: {
      kind: 'failure' as const,
      title: 'The chart did not load',
      body: 'The request failed. Try again.',
      retry: { label: 'Try again', onAct: () => undefined },
    },
  },
  {
    key: 'unauthorized',
    state: {
      kind: 'unauthorized' as const,
      title: 'You do not have access to this chart',
      body: 'Your role does not include visit analytics.',
    },
  },
  {
    key: 'integrationPending',
    state: {
      kind: 'integrationPending' as const,
      dependency: 'the visit reporting API',
      body: 'Charts populate once the visit reporting API is connected.',
    },
  },
] as const

function ChartInstance({
  state,
  planeKey,
}: {
  readonly state: GroupedBarChartProps['state']
  readonly planeKey: string
}): ReactElement {
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<readonly string[]>([])

  return (
    <GroupedBarChart
      {...READY_PROPS}
      {...(state !== undefined ? { state } : {})}
      planeKey={planeKey}
      hiddenSeriesIds={hiddenSeriesIds}
      onSeriesToggle={(id, visible) => {
        setHiddenSeriesIds((current) =>
          visible ? current.filter((entry) => entry !== id) : [...current, id],
        )
      }}
    />
  )
}

type GroupedBarChartSpecimenProps = {
  readonly stateFilter: StateFilter
  readonly planeKey: string
}

/** Grouped bar chart gallery specimen in all five states. */
export function GroupedBarChartSpecimen({
  stateFilter,
  planeKey,
}: GroupedBarChartSpecimenProps): ReactElement {
  const rows =
    stateFilter === 'all'
      ? STATE_SPECIMENS
      : STATE_SPECIMENS.filter((entry) => entry.key === stateFilter)

  return (
    <div className={styles.specimenStack}>
      {rows.map((entry) => (
        <div key={entry.key}>
          {stateFilter === 'all' ? (
            <p className={`${styles.stateLabel} column-header`}>{entry.key}</p>
          ) : null}
          <ChartInstance state={entry.state} planeKey={planeKey} />
        </div>
      ))}
    </div>
  )
}
