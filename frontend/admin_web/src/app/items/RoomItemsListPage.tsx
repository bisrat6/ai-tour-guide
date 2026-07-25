import { useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  Button,
  DataTable,
  FilterChip,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import { formatRelativeTime, useAuthoringStore, type ItemRecord } from '../rooms/authoringStore.tsx'
import styles from '../rooms/roomsAuthoring.module.css'

const MEDIA_FILTER_OPTIONS = [
  { value: 'has_image', label: 'Has image' },
  { value: 'missing_image', label: 'Missing image' },
] as const

export function RoomItemsListPage(): ReactElement {
  const navigate = useNavigate()
  const { roomId = '' } = useParams()
  const { findRoom, listRoomItems } = useAuthoringStore()
  const room = findRoom(roomId)
  const [mediaFilter, setMediaFilter] = useState<readonly string[]>([])

  const roomItems = useMemo(() => (room === undefined ? [] : listRoomItems(room.id)), [room, listRoomItems])

  const filteredByMedia = useMemo(() => {
    if (mediaFilter.length === 0) return roomItems
    const selected = mediaFilter[0]
    if (selected === 'has_image') {
      return roomItems.filter((item) => item.imageUrl.trim().length > 0)
    }
    return roomItems.filter((item) => item.imageUrl.trim().length === 0)
  }, [roomItems, mediaFilter])

  const columns = useMemo<readonly Column<ItemRecord>[]>(
    () => [
      {
        id: 'displayOrder',
        header: 'Display order',
        sortable: true,
        numeric: true,
        sortValue: (item) => item.displayOrder,
        cell: (item) => item.displayOrder,
      },
      {
        id: 'name',
        header: 'Item name',
        sortable: true,
        sortValue: (item) => item.name,
        cell: (item) => item.name,
      },
      {
        id: 'media',
        header: 'Media',
        sortable: true,
        sortValue: (item) => (item.imageUrl.trim().length > 0 ? 'with-image' : 'without-image'),
        cell: (item) => (item.imageUrl.trim().length > 0 ? 'Image linked' : 'No image yet'),
      },
      {
        id: 'lastEdited',
        header: 'Last edited',
        sortable: true,
        sortValue: (item) => item.lastEditedAt,
        cell: (item) => <span className="text-caption">{formatRelativeTime(item.lastEditedAt)}</span>,
      },
    ],
    [],
  )

  const table = useDataTable({
    rows: filteredByMedia,
    rowKey: (item) => item.id,
    columns,
    pageSize: 8,
    searchFields: [(item) => item.name, (item) => item.shortDescription, (item) => item.detailText],
    initialSort: { columnId: 'displayOrder', direction: 'ascending' },
  })

  const mediaOptions = useMemo(
    () =>
      MEDIA_FILTER_OPTIONS.map((option) => ({
        ...option,
        count:
          option.value === 'has_image'
            ? roomItems.filter((item) => item.imageUrl.trim().length > 0).length
            : roomItems.filter((item) => item.imageUrl.trim().length === 0).length,
      })),
    [roomItems],
  )

  if (room === undefined) {
    return (
      <div className={styles.page}>
        <section className={styles.panelCard}>
          <h1 className="text-title">Room not found</h1>
          <p className={`text-body ${styles.muted}`}>This room does not exist in fixture state.</p>
          <Button tone="secondary" onClick={() => navigate('../..')}>
            Back to rooms
          </Button>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Items in {room.title}</h1>
          <p className={`text-body ${styles.muted}`}>All item authoring stays scoped to the selected room.</p>
        </div>
        <div className={styles.rowActions}>
          <Button tone="secondary" onClick={() => navigate('..')}>
            Back to room
          </Button>
          <Button onClick={() => navigate('new')}>Create item</Button>
        </div>
      </header>

      <section className={styles.panelCard}>
        <DataTable
          caption={`Items in ${room.title}`}
          columns={columns}
          rows={table.pageRows}
          rowKey={(item) => item.id}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={table.pagination}
          {...(roomItems.length === 0
            ? {
                state: {
                  kind: 'empty' as const,
                  title: 'No items yet',
                  body: 'Create the first item in this room.',
                },
              }
            : {})}
          toolbar={
            <TableToolbar
              searchValue={table.searchQuery}
              onSearchChange={table.setSearchQuery}
              searchLabel="Search items"
              searchPlaceholder="Search by name or description"
              filters={
                <FilterChip
                  id="items-media-filter"
                  label="Media"
                  options={mediaOptions}
                  selected={mediaFilter}
                  multiple={false}
                  onChange={setMediaFilter}
                />
              }
              actions={<p className="text-caption">{table.total} matching items</p>}
            />
          }
          rowActions={(item) => (
            <Button tone="secondary" compact onClick={() => navigate(item.id)}>
              Edit item
            </Button>
          )}
          stickyHeader
        />
      </section>
    </div>
  )
}
