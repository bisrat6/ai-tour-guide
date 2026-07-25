import { useMemo, useState, type ReactElement } from 'react'

import { FilterChip, FilterChipRow } from '../../kit/FilterChip/index.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import {
  STATUS_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  UPDATED_FILTER_OPTIONS,
} from '../fixtures/filters.ts'
import { SpecimenStack } from './SpecimenStack.tsx'

const NA_NOTES = [
  {
    state: 'empty' as const,
    reason: 'Does not apply: a filter with no options should not be rendered.',
  },
  {
    state: 'unauthorized' as const,
    reason: 'Does not apply: a filter over data a role cannot see is absent.',
  },
] as const

export function FilterChipSpecimen({
  stateFilter,
}: {
  readonly stateFilter: StateFilter
}): ReactElement {
  const [status, setStatus] = useState<readonly string[]>(['ready'])
  const [type, setType] = useState<readonly string[]>([])
  const [updated, setUpdated] = useState<readonly string[]>([])

  const activeCount = useMemo(
    () => status.length + type.length + updated.length,
    [status.length, type.length, updated.length],
  )

  function clearAll(): void {
    setStatus([])
    setType([])
    setUpdated([])
  }

  return (
    <SpecimenStack stateFilter={stateFilter} notes={[...NA_NOTES]}>
      {(state) => {
        if (state === 'ready') {
          return (
            <FilterChipRow label="Filter rooms" activeCount={activeCount} onClearAll={clearAll}>
              <FilterChip
                id="filter-status"
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={status}
                onChange={setStatus}
                multiple
              />
              <FilterChip
                id="filter-type"
                label="Type"
                options={TYPE_FILTER_OPTIONS}
                selected={type}
                onChange={setType}
              />
              <FilterChip
                id="filter-updated"
                label="Updated"
                options={UPDATED_FILTER_OPTIONS}
                selected={updated}
                onChange={setUpdated}
              />
            </FilterChipRow>
          )
        }

        if (state === 'loading') {
          return (
            <FilterChipRow label="Filter rooms" activeCount={0} onClearAll={() => undefined}>
              <FilterChip
                id="filter-status-loading"
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={[]}
                onChange={() => undefined}
                state={{ kind: 'loading' }}
              />
            </FilterChipRow>
          )
        }

        if (state === 'failure') {
          return (
            <FilterChipRow label="Filter rooms" activeCount={0} onClearAll={() => undefined}>
              <FilterChip
                id="filter-status-failure"
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={[]}
                onChange={() => undefined}
                state={{
                  kind: 'failure',
                  title: 'Filter options did not load.',
                  body: 'Try again.',
                }}
              />
            </FilterChipRow>
          )
        }

        if (state === 'integrationPending') {
          return (
            <FilterChipRow label="Filter rooms" activeCount={0} onClearAll={() => undefined}>
              <FilterChip
                id="filter-status-pending"
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={[]}
                onChange={() => undefined}
                disabled
                disabledReason="Not editable until search index is connected."
              />
            </FilterChipRow>
          )
        }

        return null
      }}
    </SpecimenStack>
  )
}
