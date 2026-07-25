import { useId, useMemo, useRef, useState, type ReactElement } from 'react'

import { BulkActionBar } from '../../kit/BulkActionBar/BulkActionBar.tsx'
import { Button } from '../../kit/Button/Button.tsx'
import { DataTable } from '../../kit/DataTable/DataTable.tsx'
import type { Column } from '../../kit/DataTable/DataTable.types.ts'
import { TableToolbar } from '../../kit/DataTable/TableToolbar.tsx'
import { useDataTable } from '../../kit/DataTable/useDataTable.ts'
import { FilterChip, FilterChipRow } from '../../kit/FilterChip/index.ts'
import { PeekPanel } from '../../kit/PeekPanel/PeekPanel.tsx'
import { StatusBadge } from '../../kit/StatusBadge/StatusBadge.tsx'
import type { KitState, StatusTone } from '../../kit/types.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import { ROOMS, type RoomFixture } from '../fixtures/rooms.ts'
import styles from '../Gallery.module.css'
import { SpecimenStack } from './SpecimenStack.tsx'

const NARRATION_LABEL: Readonly<Record<StatusTone, string>> = {
  success: 'Ready',
  warning: 'Needs review',
  danger: 'Blocked',
  neutral: 'Draft',
}

const NARRATION_FILTER_OPTIONS = [
  { value: 'success', label: 'Ready' },
  { value: 'warning', label: 'Needs review' },
  { value: 'danger', label: 'Blocked' },
  { value: 'neutral', label: 'Draft' },
] as const

function formatUpdated(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

const ROOM_COLUMNS: readonly Column<RoomFixture>[] = [
  {
    id: 'title',
    header: 'Room',
    sortable: true,
    sortValue: (row) => row.title,
    cell: (row) => row.title,
  },
  {
    id: 'order',
    header: 'Order',
    numeric: true,
    sortable: true,
    sortValue: (row) => row.order,
    width: '4.5rem',
    cell: (row) => row.order,
  },
  {
    id: 'items',
    header: 'Items',
    numeric: true,
    sortable: true,
    sortValue: (row) => row.itemCount,
    width: '5rem',
    cell: (row) => row.itemCount,
  },
  {
    id: 'narration',
    header: 'Narration',
    sortable: true,
    sortValue: (row) => row.narrationStatus,
    cell: (row) => (
      <StatusBadge tone={row.narrationStatus} label={NARRATION_LABEL[row.narrationStatus]} />
    ),
  },
  {
    id: 'updated',
    header: 'Updated',
    sortable: true,
    sortValue: (row) => row.updatedAt,
    hideBelow: 768,
    cell: (row) => <span className="text-caption">{formatUpdated(row.updatedAt)}</span>,
  },
]

type InteractiveTableProps = {
  readonly state?: KitState
  readonly density?: 'comfortable' | 'compact'
  readonly stickyHeader?: boolean
  readonly emptyRooms?: boolean
}

function InteractiveRoomsTable({
  state,
  density = 'comfortable',
  stickyHeader = false,
  emptyRooms = false,
}: InteractiveTableProps): ReactElement {
  const [statusFilter, setStatusFilter] = useState<readonly string[]>([])
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null)
  const [peekOpen, setPeekOpen] = useState(false)
  const [peekTab, setPeekTab] = useState('overview')
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const filterId = useId()

  const sourceRows = useMemo(
    () => (emptyRooms ? ([] as RoomFixture[]) : ([...ROOMS] as RoomFixture[])),
    [emptyRooms],
  )

  const filteredSource = useMemo(() => {
    if (statusFilter.length === 0) return sourceRows
    return sourceRows.filter((row) => statusFilter.includes(row.narrationStatus))
  }, [sourceRows, statusFilter])

  const table = useDataTable({
    rows: filteredSource,
    rowKey: (row) => row.id,
    columns: ROOM_COLUMNS,
    pageSize: 5,
    searchFields: [(row) => row.title, (row) => String(row.order)],
    initialSort: { columnId: 'order', direction: 'ascending' },
  })

  const activeRow = filteredSource.find((row) => row.id === activeRowKey) ?? null

  const resolvedState: KitState | undefined = (() => {
    if (state !== undefined) return state
    if (emptyRooms) {
      return {
        kind: 'empty',
        title: 'No rooms yet',
        body: 'Add the first room to start the tour.',
        action: { label: 'Add room', onAct: () => undefined },
      }
    }
    return undefined
  })()

  const rangeStart = table.total === 0 ? 0 : (table.page - 1) * table.pageSize + 1
  const rangeEnd = Math.min(table.page * table.pageSize, table.total)
  const resultSummary =
    table.total === 0 ? '0 rooms' : `${rangeStart}–${rangeEnd} of ${table.total}`

  return (
    <div className={styles.specimenStack}>
      <DataTable
        caption="Rooms"
        columns={ROOM_COLUMNS}
        rows={table.pageRows}
        rowKey={(row) => row.id}
        {...(resolvedState !== undefined ? { state: resolvedState } : {})}
        sort={table.sort}
        onSortChange={table.setSort}
        selection={{
          selectedKeys: table.selectedKeys,
          onChange: table.setSelectedKeys,
          rowLabel: (row) => row.title,
        }}
        pagination={table.pagination}
        onRowActivate={(row) => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          setActiveRowKey(row.id)
          setPeekTab('overview')
          setPeekOpen(true)
        }}
        activeRowKey={activeRowKey}
        density={density}
        stickyHeader={stickyHeader}
        toolbar={
          <TableToolbar
            searchValue={table.searchQuery}
            onSearchChange={table.setSearchQuery}
            searchLabel="Search rooms"
            searchPlaceholder="Search by title or order"
            resultSummary={resultSummary}
            filters={
              <FilterChipRow
                label="Filter rooms"
                activeCount={statusFilter.length}
                onClearAll={() => setStatusFilter([])}
              >
                <FilterChip
                  id={filterId}
                  label="Narration"
                  options={[...NARRATION_FILTER_OPTIONS]}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  multiple
                />
              </FilterChipRow>
            }
            actions={
              <Button tone="secondary" compact>
                Add room
              </Button>
            }
            loading={resolvedState?.kind === 'loading'}
          />
        }
      />

      <BulkActionBar
        selectedKeys={table.selectedKeys}
        noun={{ one: 'room', many: 'rooms' }}
        onClear={table.clearSelection}
        actions={[
          {
            id: 'archive',
            label: 'Archive',
            tone: 'secondary',
            onAct: () => table.clearSelection(),
          },
          {
            id: 'delete',
            label: 'Delete',
            tone: 'danger',
            confirm: {
              title: 'Delete selected rooms?',
              consequence: 'Deleted rooms leave the tour until restored from trash.',
              confirmLabel: 'Delete rooms',
            },
            onAct: () => table.clearSelection(),
          },
        ]}
      />

      {activeRow !== null ? (
        <PeekPanel
          open={peekOpen}
          title={activeRow.title}
          subtitle={`Order ${activeRow.order} · ${activeRow.itemCount} items`}
          status={{
            tone: activeRow.narrationStatus,
            label: NARRATION_LABEL[activeRow.narrationStatus],
          }}
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              content: (
                <p className="text-body">
                  {activeRow.title} holds {activeRow.itemCount} items. Narration is{' '}
                  {NARRATION_LABEL[activeRow.narrationStatus].toLowerCase()}.
                </p>
              ),
            },
            {
              id: 'items',
              label: 'Items',
              count: activeRow.itemCount,
              content: <p className="text-body">Item list mounts in a later phase.</p>,
            },
          ]}
          activeTabId={peekTab}
          onTabChange={setPeekTab}
          returnFocusTo={returnFocusRef}
          onClose={() => {
            setPeekOpen(false)
            setActiveRowKey(null)
          }}
          footer={
            <Button
              tone="primary"
              onClick={() => {
                setPeekOpen(false)
                setActiveRowKey(null)
              }}
            >
              Done
            </Button>
          }
        />
      ) : null}
    </div>
  )
}

function stateForFilter(kind: Exclude<KitState['kind'], 'ready'>): KitState {
  if (kind === 'loading') return { kind: 'loading', label: 'rooms' }
  if (kind === 'empty') {
    return {
      kind: 'empty',
      title: 'No rooms yet',
      body: 'Add the first room to start the tour.',
      action: { label: 'Add room', onAct: () => undefined },
    }
  }
  if (kind === 'failure') {
    return {
      kind: 'failure',
      title: 'The table did not load',
      body: 'The request failed. Try again, or reload the page.',
      retry: { label: 'Try again', onAct: () => undefined },
    }
  }
  if (kind === 'unauthorized') {
    return {
      kind: 'unauthorized',
      title: 'You do not have access to this',
      body: 'Your role does not include these records.',
    }
  }
  return {
    kind: 'integrationPending',
    dependency: 'Room catalogue',
    body: 'Connect the CMS room feed to load the table.',
    stillUsable: 'Filters and search stay available while the feed is offline.',
  }
}

/** Data table gallery specimen — interactive rooms table plus five states. */
export function DataTableSpecimen({
  stateFilter,
}: {
  readonly stateFilter: StateFilter
}): ReactElement {
  return (
    <SpecimenStack stateFilter={stateFilter}>
      {(state) => {
        if (state === 'ready') {
          return (
            <div className={styles.specimenStack}>
              <p className={`${styles.stateHeading} column-header`}>Interactive</p>
              <InteractiveRoomsTable stickyHeader />
              <p className={`${styles.stateHeading} column-header`}>Compact density</p>
              <InteractiveRoomsTable density="compact" />
            </div>
          )
        }

        if (state === 'empty') {
          return (
            <div className={styles.specimenStack}>
              <p className={`${styles.stateHeading} column-header`}>No records</p>
              <InteractiveRoomsTable emptyRooms state={stateForFilter('empty')} />
              <p className={`${styles.stateHeading} column-header`}>No matches</p>
              <InteractiveRoomsTable
                state={{
                  kind: 'empty',
                  title: 'No matches',
                  body: 'No rows match the current search and filters.',
                  action: {
                    label: 'Clear all filters',
                    onAct: () => undefined,
                  },
                }}
              />
            </div>
          )
        }

        return <InteractiveRoomsTable state={stateForFilter(state)} />
      }}
    </SpecimenStack>
  )
}
