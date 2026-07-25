import { useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Button,
  DataTable,
  FilterChip,
  StatusBadge,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import {
  formatRelativeTime,
  narrationLabel,
  narrationTone,
  useAuthoringStore,
  type RoomRecord,
} from './authoringStore.tsx'
import styles from './roomsAuthoring.module.css'

const STATUS_OPTIONS = [
  { value: 'ready', label: 'Ready' },
  { value: 'generating', label: 'Generating' },
  { value: 'revision', label: 'Needs revision' },
  { value: 'not_started', label: 'Not started' },
] as const

export function RoomsListPage(): ReactElement {
  const navigate = useNavigate()
  const { rooms, listRoomItems } = useAuthoringStore()
  const [statusFilter, setStatusFilter] = useState<readonly string[]>([])

  const columns = useMemo<readonly Column<RoomRecord>[]>(
    () => [
      {
        id: 'storyOrder',
        header: 'Story order',
        numeric: true,
        sortable: true,
        sortValue: (room) => room.storyOrder,
        cell: (room) => room.storyOrder,
      },
      {
        id: 'title',
        header: 'Room title',
        sortable: true,
        sortValue: (room) => room.title,
        cell: (room) => room.title,
      },
      {
        id: 'itemCount',
        header: 'Item count',
        numeric: true,
        sortable: true,
        sortValue: (room) => listRoomItems(room.id).length,
        cell: (room) => listRoomItems(room.id).length,
      },
      {
        id: 'narration',
        header: 'Narration',
        sortable: true,
        sortValue: (room) => narrationLabel(room.narrationStatus),
        cell: (room) => (
          <StatusBadge
            tone={narrationTone(room.narrationStatus)}
            label={narrationLabel(room.narrationStatus)}
            detail={`${room.title} narration status`}
          />
        ),
      },
      {
        id: 'lastEdited',
        header: 'Last edited',
        sortable: true,
        sortValue: (room) => room.lastEditedAt,
        cell: (room) => <span className="text-caption">{formatRelativeTime(room.lastEditedAt)}</span>,
      },
    ],
    [listRoomItems],
  )

  const statusFilteredRooms = useMemo(() => {
    if (statusFilter.length === 0) return rooms
    const selected = statusFilter[0]
    return rooms.filter((room) => room.narrationStatus === selected)
  }, [rooms, statusFilter])

  const table = useDataTable({
    rows: statusFilteredRooms,
    rowKey: (room) => room.id,
    columns,
    pageSize: 8,
    searchFields: [(room) => room.title, (room) => room.roomOverviewText],
    initialSort: { columnId: 'storyOrder', direction: 'ascending' },
  })

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((option) => ({
        ...option,
        count: rooms.filter((room) => room.narrationStatus === option.value).length,
      })),
    [rooms],
  )

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Rooms</h1>
          <p className={`text-body ${styles.muted}`}>
            Author room sequence, narration readiness, and linked room flow.
          </p>
        </div>
        <Button onClick={() => navigate('new')}>Create room</Button>
      </header>

      <section className={styles.panelCard}>
        <DataTable
          caption="Rooms"
          columns={columns}
          rows={table.pageRows}
          rowKey={(room) => room.id}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={table.pagination}
          {...(rooms.length === 0
            ? { state: { kind: 'empty' as const, title: 'No rooms yet', body: 'Create your first room.' } }
            : {})}
          toolbar={
            <TableToolbar
              searchValue={table.searchQuery}
              onSearchChange={table.setSearchQuery}
              searchLabel="Search rooms"
              searchPlaceholder="Search by title or overview"
              filters={
                <FilterChip
                  id="rooms-status-filter"
                  label="Narration status"
                  options={statusOptions}
                  selected={statusFilter}
                  multiple={false}
                  onChange={setStatusFilter}
                />
              }
              actions={<p className="text-caption">{table.total} matching rooms</p>}
            />
          }
          rowActions={(room) => (
            <div className={styles.rowActions}>
              <Button tone="secondary" compact onClick={() => navigate(room.id)}>
                Edit
              </Button>
              <Button tone="ghost" compact onClick={() => navigate(`${room.id}/items`)}>
                Items
              </Button>
            </div>
          )}
          stickyHeader
        />
      </section>
    </div>
  )
}
