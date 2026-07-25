import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  Column,
  SortState,
  TablePagination,
  UseDataTableOptions,
} from './DataTable.types.ts'

const DEFAULT_PAGE_SIZE = 10

export type UseDataTableResult<Row> = {
  /** Rows on the current page after sort, search and pagination. */
  readonly pageRows: readonly Row[]
  /** All rows after sort and search, before pagination. */
  readonly filteredRows: readonly Row[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
  readonly setPage: (page: number) => void
  readonly pagination: TablePagination
  readonly sort: SortState | null
  readonly setSort: (next: SortState | null) => void
  /** Cycles ascending → descending → none for a sortable column. */
  readonly toggleSort: (columnId: string) => void
  readonly searchQuery: string
  readonly setSearchQuery: (query: string) => void
  readonly selectedKeys: ReadonlySet<string>
  readonly setSelectedKeys: (next: ReadonlySet<string>) => void
  readonly toggleRowSelection: (key: string, options?: { readonly shiftKey?: boolean }) => void
  readonly togglePageSelection: () => void
  readonly clearSelection: () => void
  readonly isRowSelected: (key: string) => boolean
  readonly isPageFullySelected: boolean
  readonly isPagePartiallySelected: boolean
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly Column<Row>[],
  sort: SortState | null,
): readonly Row[] {
  if (sort === null) return rows

  const column = columns.find((entry) => entry.id === sort.columnId)
  if (column?.sortable !== true) return rows

  const getValue = column.sortValue ?? ((row: Row) => {
    const rendered = column.cell(row)
    return typeof rendered === 'string' || typeof rendered === 'number' ? rendered : ''
  })

  const sorted = [...rows]
  sorted.sort((left, right) => {
    const compared = compareValues(getValue(left), getValue(right))
    return sort.direction === 'ascending' ? compared : -compared
  })
  return sorted
}

export function filterRowsBySearch<Row>(
  rows: readonly Row[],
  searchQuery: string,
  searchFields: readonly ((row: Row) => string)[] | undefined,
): readonly Row[] {
  const needle = searchQuery.trim().toLowerCase()
  if (needle === '' || searchFields === undefined || searchFields.length === 0) {
    return rows
  }

  return rows.filter((row) =>
    searchFields.some((field) => field(row).toLowerCase().includes(needle)),
  )
}

export function paginateRows<Row>(
  rows: readonly Row[],
  page: number,
  pageSize: number,
): readonly Row[] {
  if (rows.length === 0) return rows
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export function pageCountFor(total: number, pageSize: number): number {
  if (total === 0) return 1
  return Math.ceil(total / pageSize)
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const maxPage = pageCountFor(total, pageSize)
  return Math.min(Math.max(page, 1), maxPage)
}

export function nextSortState(
  current: SortState | null,
  columnId: string,
): SortState | null {
  if (current?.columnId !== columnId) {
    return { columnId, direction: 'ascending' }
  }
  if (current.direction === 'ascending') {
    return { columnId, direction: 'descending' }
  }
  return null
}

export function rangeSelectionKeys<Row>(
  rows: readonly Row[],
  rowKey: (row: Row) => string,
  anchorKey: string,
  targetKey: string,
  selectedKeys: ReadonlySet<string>,
): ReadonlySet<string> {
  const keys = rows.map(rowKey)
  const anchorIndex = keys.indexOf(anchorKey)
  const targetIndex = keys.indexOf(targetKey)
  if (anchorIndex === -1 || targetIndex === -1) return selectedKeys

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  const next = new Set(selectedKeys)
  for (let index = start; index <= end; index += 1) {
    next.add(keys[index]!)
  }
  return next
}

/**
 * Headless sorting, text search, pagination and keyed row selection.
 *
 * Manual verification (no vitest in this package):
 * - Sort a sortable column: asc → desc → natural order; only one column sorted at a time.
 * - Search narrows rows; clearing search restores the full set; page resets to 1 on search/sort change.
 * - With 7 rows and pageSize 5: page 1 shows 5 rows, page 2 shows 2; Previous/Next bounds behave correctly.
 * - Toggle row selection by key; selected keys persist after sort or page change.
 * - Shift+toggle selects the inclusive range between anchor and target in filtered row order.
 * - Non-shift toggle moves the anchor; toggle all on page selects/deselects visible keys only.
 */
export function useDataTable<Row>({
  rows,
  rowKey,
  columns,
  pageSize = DEFAULT_PAGE_SIZE,
  searchFields,
  initialSort = null,
}: UseDataTableOptions<Row>): UseDataTableResult<Row> {
  const [sort, setSortState] = useState<SortState | null>(initialSort)
  const [searchQuery, setSearchQueryState] = useState('')
  const [page, setPageState] = useState(1)
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null)

  const sortedRows = useMemo(
    () => sortRows(rows, columns, sort),
    [rows, columns, sort],
  )

  const filteredRows = useMemo(
    () => filterRowsBySearch(sortedRows, searchQuery, searchFields),
    [sortedRows, searchQuery, searchFields],
  )

  const total = filteredRows.length
  const pageCount = pageCountFor(total, pageSize)
  const clampedPage = clampPage(page, total, pageSize)

  useEffect(() => {
    if (page !== clampedPage) {
      setPageState(clampedPage)
    }
  }, [page, clampedPage])

  const pageRows = useMemo(
    () => paginateRows(filteredRows, clampedPage, pageSize),
    [filteredRows, clampedPage, pageSize],
  )

  const pageKeys = useMemo(
    () => pageRows.map(rowKey),
    [pageRows, rowKey],
  )

  const setSort = useCallback((next: SortState | null) => {
    setSortState(next)
    setPageState(1)
  }, [])

  const toggleSort = useCallback(
    (columnId: string) => {
      setSort(nextSortState(sort, columnId))
    },
    [sort, setSort],
  )

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query)
    setPageState(1)
  }, [])

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState(clampPage(nextPage, total, pageSize))
    },
    [total, pageSize],
  )

  const toggleRowSelection = useCallback(
    (key: string, options?: { readonly shiftKey?: boolean }) => {
      setSelectedKeys((current) => {
        if (options?.shiftKey === true && selectionAnchor !== null) {
          return rangeSelectionKeys(filteredRows, rowKey, selectionAnchor, key, current)
        }

        const next = new Set(current)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })

      if (options?.shiftKey !== true) {
        setSelectionAnchor(key)
      }
    },
    [filteredRows, rowKey, selectionAnchor],
  )

  const togglePageSelection = useCallback(() => {
    const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selectedKeys.has(key))
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (allSelected) {
        for (const key of pageKeys) next.delete(key)
      } else {
        for (const key of pageKeys) next.add(key)
      }
      return next
    })
    setSelectionAnchor(null)
  }, [pageKeys, selectedKeys])

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
    setSelectionAnchor(null)
  }, [])

  const replaceSelectedKeys = useCallback((next: ReadonlySet<string>) => {
    setSelectedKeys(next)
  }, [])

  const isRowSelected = useCallback(
    (key: string) => selectedKeys.has(key),
    [selectedKeys],
  )

  const selectedOnPageCount = pageKeys.filter((key) => selectedKeys.has(key)).length
  const isPageFullySelected = pageKeys.length > 0 && selectedOnPageCount === pageKeys.length
  const isPagePartiallySelected = selectedOnPageCount > 0 && !isPageFullySelected

  const pagination = useMemo(
    (): TablePagination => ({
      page: clampedPage,
      pageSize,
      total,
      onPageChange: setPage,
    }),
    [clampedPage, pageSize, total, setPage],
  )

  return {
    pageRows,
    filteredRows,
    total,
    page: clampedPage,
    pageSize,
    pageCount,
    setPage,
    pagination,
    sort,
    setSort,
    toggleSort,
    searchQuery,
    setSearchQuery,
    selectedKeys,
    setSelectedKeys: replaceSelectedKeys,
    toggleRowSelection,
    togglePageSelection,
    clearSelection,
    isRowSelected,
    isPageFullySelected,
    isPagePartiallySelected,
  }
}
