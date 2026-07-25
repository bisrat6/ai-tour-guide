import type { KitState, Provenance } from '../types.ts'

export type ChartSeries = {
  readonly id: string
  readonly label: string
  /** Exactly one series should be 'primary'; the rest are 'comparison'. */
  readonly role: 'primary' | 'comparison'
  /** Same length and order as `categories`. */
  readonly values: readonly number[]
}

export type GroupedBarChartProps = {
  readonly title: string
  /** One sentence, used as the canvas's accessible summary. */
  readonly description: string
  readonly categories: readonly string[]
  readonly series: readonly ChartSeries[]
  /** The kit never formats numbers; locale and currency are the caller's. */
  readonly valueFormat: (value: number) => string
  readonly axisLabel?: string
  readonly provenance: Provenance
  readonly hiddenSeriesIds?: readonly string[]
  readonly onSeriesToggle?: (id: string, visible: boolean) => void
  readonly state?: KitState
  /** Fixed height so the skeleton and the chart occupy the same box. */
  readonly height?: number
  /** Repaint trigger only. Never read as a colour source. */
  readonly planeKey?: string
}

export type ChartDataTableProps = {
  readonly id: string
  readonly caption: string
  readonly categories: readonly string[]
  readonly series: readonly ChartSeries[]
  readonly valueFormat: (value: number) => string
  readonly visible: boolean
}

export type SeriesToggleProps = {
  readonly series: readonly ChartSeries[]
  readonly hiddenSeriesIds: readonly string[]
  readonly onToggle: (id: string, visible: boolean) => void
}
