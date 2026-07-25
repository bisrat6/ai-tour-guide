import type { FilterOption } from './FilterChip.types.ts'

function defaultSummarize(label: string, selected: readonly FilterOption[]): string {
  if (selected.length === 0) return `${label}: All`
  if (selected.length === 1) return `${label}: ${selected[0].label}`
  return `${label}: ${selected.length}`
}

export type FilterChipSummaryProps = {
  readonly label: string
  readonly options: readonly FilterOption[]
  readonly selected: readonly string[]
  readonly summarize?: (selected: readonly FilterOption[]) => string
}

export function summarizeFilterChip({
  label,
  options,
  selected,
  summarize,
}: FilterChipSummaryProps): string {
  const selectedOptions = options.filter((option) => selected.includes(option.value))
  if (summarize !== undefined) return summarize(selectedOptions)
  return defaultSummarize(label, selectedOptions)
}
