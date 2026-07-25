import type { ReactNode } from 'react'
import type { Density, KitState } from '../types.ts'

export type SortDirection = 'ascending' | 'descending'
export type SortState = { readonly columnId: string; readonly direction: SortDirection }

export type Column<Row> = {
  readonly id: string
  readonly header: string
  /** Actions columns keep a real header, visually hidden — never an empty th. */
  readonly headerHidden?: boolean
  readonly cell: (row: Row) => ReactNode
  /** Applies tabular-nums and end alignment. */
  readonly numeric?: boolean
  readonly sortable?: boolean
  /** Required when sortable and the cell is not a plain string. */
  readonly sortValue?: (row: Row) => string | number
  readonly width?: string
  /** Columns dropped below this viewport width; content moves into the peek panel. */
  readonly hideBelow?: 768 | 1024 | 1280
}

export type RowSelection<Row> = {
  readonly selectedKeys: ReadonlySet<string>
  readonly onChange: (next: ReadonlySet<string>) => void
  /** Names the row in the checkbox label: "Select The Road to Adwa". */
  readonly rowLabel: (row: Row) => string
  readonly selectableRow?: (row: Row) => boolean
}

export type TablePagination = {
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
}

export type DataTableProps<Row> = {
  /** Visually hidden <caption>. Required: a table without a name is unusable by AT. */
  readonly caption: string
  readonly columns: readonly Column<Row>[]
  readonly rows: readonly Row[]
  readonly rowKey: (row: Row) => string
  readonly state?: KitState
  readonly sort?: SortState | null
  readonly onSortChange?: (next: SortState | null) => void
  readonly selection?: RowSelection<Row>
  readonly pagination?: TablePagination
  readonly rowActions?: (row: Row) => ReactNode
  /** Opens the peek panel. Rendered as a real button in the first cell. */
  readonly onRowActivate?: (row: Row) => void
  readonly activeRowKey?: string | null
  readonly density?: Density
  readonly skeletonRows?: number
  readonly toolbar?: ReactNode
  readonly stickyHeader?: boolean
}

export type TableToolbarProps = {
  readonly searchValue: string
  readonly onSearchChange: (value: string) => void
  readonly searchLabel: string
  readonly searchPlaceholder?: string
  readonly filters?: ReactNode
  readonly actions?: ReactNode
  readonly resultSummary?: string
}

/** Headless sorting, filtering, paging and selection. No DOM, no tokens. */
export type UseDataTableOptions<Row> = {
  readonly rows: readonly Row[]
  readonly rowKey: (row: Row) => string
  readonly columns: readonly Column<Row>[]
  readonly pageSize?: number
  readonly searchFields?: readonly ((row: Row) => string)[]
  readonly initialSort?: SortState | null
}

export type PaginationProps = {
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
}
