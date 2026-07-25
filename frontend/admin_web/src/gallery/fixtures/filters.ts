import type { FilterOption } from '../../kit/FilterChip/FilterChip.types.ts'

export const STATUS_FILTER_OPTIONS = [
  { value: 'ready', label: 'Ready', count: 12 },
  { value: 'pending', label: 'Pending', count: 3 },
  { value: 'draft', label: 'Draft', count: 5 },
  { value: 'suspended', label: 'Suspended', count: 1 },
] as const satisfies readonly FilterOption[]

export const TYPE_FILTER_OPTIONS = [
  { value: 'gallery', label: 'Gallery room' },
  { value: 'outdoor', label: 'Outdoor stop' },
  { value: 'foyer', label: 'Foyer' },
] as const satisfies readonly FilterOption[]

export const UPDATED_FILTER_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
] as const satisfies readonly FilterOption[]
