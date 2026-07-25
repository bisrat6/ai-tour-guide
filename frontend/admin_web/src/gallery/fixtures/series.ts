import type { ChartSeries } from '../../kit/Chart/Chart.types.ts'
import type { Provenance } from '../../kit/types.ts'

export const chartCategories = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
] as const satisfies readonly string[]

export const chartSeries = [
  {
    id: 'narrations',
    label: 'Narrations played',
    role: 'primary',
    values: [420, 510, 480, 620, 590, 710],
  },
  {
    id: 'rooms',
    label: 'Rooms visited',
    role: 'comparison',
    values: [180, 210, 195, 240, 230, 260],
  },
] as const satisfies readonly ChartSeries[]

export const chartProvenance = 'demo' as const satisfies Provenance

export const chartTitle = 'Room narration volume by month'
export const chartDescription =
  'Room narration volume by month, two series, six months'
export const chartAxisLabel = 'Month'

export function formatChartValue(value: number): string {
  return value.toLocaleString('en-US')
}
