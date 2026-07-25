import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { Checkbox } from '../Field/Checkbox.tsx'
import { SR_ONLY_CLASS } from '../internal/srOnly.ts'
import { StateBlock } from '../State/StateBlock.tsx'
import { resolveState, type KitState } from '../types.ts'
import { ColumnHeaderButton } from './ColumnHeaderButton.tsx'
import type { Column, DataTableProps, SortDirection } from './DataTable.types.ts'
import styles from './DataTable.module.css'
import { Pagination } from './Pagination.tsx'
import { TableSkeletonRows } from './TableSkeleton.tsx'

const NO_MATCHES_EMPTY: Extract<KitState, { kind: 'empty' }> = {
  kind: 'empty',
  title: 'No matches',
  body: 'No rows match the current search and filters.',
}

const DEFAULT_FAILURE: Extract<KitState, { kind: 'failure' }> = {
  kind: 'failure',
  title: 'The table did not load',
  body: 'The request failed. Try again, or reload the page.',
  retry: { label: 'Try again', onAct: () => undefined },
}

const DEFAULT_UNAUTHORIZED: Extract<KitState, { kind: 'unauthorized' }> = {
  kind: 'unauthorized',
  title: 'You do not have access to this',
  body: 'Your role does not include these records.',
}

function hideBelowClass(hideBelow: 768 | 1024 | 1280 | undefined): string {
  if (hideBelow === 768) return styles.hideBelow768
  if (hideBelow === 1024) return styles.hideBelow1024
  if (hideBelow === 1280) return styles.hideBelow1280
  return ''
}

function ariaSortValue(
  columnId: string,
  sort: DataTableProps<unknown>['sort'],
  sortable: boolean | undefined,
): 'ascending' | 'descending' | 'none' | undefined {
  if (sortable !== true) return undefined
  if (sort?.columnId === columnId) return sort.direction
  return 'none'
}

function sortDirectionFor(
  columnId: string,
  sort: DataTableProps<unknown>['sort'],
): SortDirection | 'none' {
  if (sort?.columnId === columnId) return sort.direction
  return 'none'
}

function nextSort(
  current: DataTableProps<unknown>['sort'],
  columnId: string,
): NonNullable<DataTableProps<unknown>['sort']> | null {
  if (current?.columnId !== columnId) {
    return { columnId, direction: 'ascending' }
  }
  if (current.direction === 'ascending') {
    return { columnId, direction: 'descending' }
  }
  return null
}

function entityLabelFromCaption(caption: string): string {
  const trimmed = caption.trim()
  if (trimmed.length === 0) return 'rows'
  return trimmed
}

/** Shared data table: sort, selection, pagination, and the five kit states. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  state,
  sort = null,
  onSortChange,
  selection,
  pagination,
  rowActions,
  onRowActivate,
  activeRowKey = null,
  density = 'comfortable',
  skeletonRows = 5,
  toolbar,
  stickyHeader = false,
}: DataTableProps<Row>): ReactElement {
  const labelId = useId()
  const headerCheckboxId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const [scrollable, setScrollable] = useState(false)

  const resolved = resolveState(state)
  const hasSelection = selection !== undefined
  const hasActions = rowActions !== undefined || onRowActivate !== undefined
  const entityLabel = entityLabelFromCaption(caption)

  const updateScrollable = useCallback(() => {
    const node = scrollRef.current
    if (node === null) {
      setScrollable(false)
      return
    }
    setScrollable(node.scrollWidth > node.clientWidth + 1)
  }, [])

  useEffect(() => {
    updateScrollable()
    const node = scrollRef.current
    if (node === null || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      updateScrollable()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [updateScrollable, columns, rows, resolved.kind])

  const selectablePageKeys = hasSelection
    ? rows
        .filter((row) => selection.selectableRow?.(row) !== false)
        .map((row) => rowKey(row))
    : []

  const selectedOnPage = selectablePageKeys.filter((key) => selection?.selectedKeys.has(key))
  const allPageSelected =
    selectablePageKeys.length > 0 && selectedOnPage.length === selectablePageKeys.length
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected

  function clearSelectionAndFocusHeader(): void {
    if (selection === undefined) return
    selection.onChange(new Set())
    headerCheckboxRef.current?.focus()
  }

  function handleTableKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape') return
    if (selection === undefined || selection.selectedKeys.size === 0) return
    event.preventDefault()
    clearSelectionAndFocusHeader()
  }

  function toggleSort(columnId: string): void {
    if (onSortChange === undefined) return
    onSortChange(nextSort(sort, columnId))
  }

  function handleSelectAll(checked: boolean): void {
    if (selection === undefined) return
    const next = new Set(selection.selectedKeys)
    if (checked) {
      for (const key of selectablePageKeys) next.add(key)
    } else {
      for (const key of selectablePageKeys) next.delete(key)
    }
    selection.onChange(next)
    selectionAnchorRef.current = null
  }

  function handleRowCheckboxChange(
    row: Row,
    _checked: boolean,
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    if (selection === undefined) return
    const key = rowKey(row)
    const native = event.nativeEvent as { readonly shiftKey?: boolean }
    const shiftKey = native.shiftKey === true
    const pageKeys = rows.map(rowKey)

    if (shiftKey && selectionAnchorRef.current !== null) {
      const anchorIndex = pageKeys.indexOf(selectionAnchorRef.current)
      const targetIndex = pageKeys.indexOf(key)
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const start = Math.min(anchorIndex, targetIndex)
        const end = Math.max(anchorIndex, targetIndex)
        const next = new Set(selection.selectedKeys)
        for (let index = start; index <= end; index += 1) {
          const pageKey = pageKeys[index]
          if (pageKey !== undefined) next.add(pageKey)
        }
        selection.onChange(next)
        return
      }
    }

    const next = new Set(selection.selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selection.onChange(next)
    selectionAnchorRef.current = key
  }

  if (resolved.kind === 'unauthorized') {
    const unauthorized = {
      ...DEFAULT_UNAUTHORIZED,
      ...(state?.kind === 'unauthorized' ? state : {}),
    }
    return (
      <div
        className={styles.root}
        role="region"
        aria-labelledby={labelId}
        data-table-region
      >
        <h2 id={labelId} className={SR_ONLY_CLASS}>
          {caption}
        </h2>
        <StateBlock state={unauthorized} size="region" />
      </div>
    )
  }

  const isLoading = resolved.kind === 'loading'
  const showBodyMessage =
    resolved.kind === 'failure' ||
    resolved.kind === 'integrationPending' ||
    resolved.kind === 'empty' ||
    (resolved.kind === 'ready' && rows.length === 0)

  let bodyMessage: ReactNode = null
  if (resolved.kind === 'failure') {
    const failure: Extract<KitState, { kind: 'failure' }> = {
      kind: 'failure',
      title: resolved.title || DEFAULT_FAILURE.title,
      body: resolved.body || DEFAULT_FAILURE.body,
      ...(resolved.retry !== undefined
        ? { retry: resolved.retry }
        : { retry: { label: 'Try again', onAct: () => undefined } }),
    }
    bodyMessage = <StateBlock state={failure} size="region" />
  } else if (resolved.kind === 'integrationPending') {
    bodyMessage = <StateBlock state={resolved} size="region" />
  } else if (resolved.kind === 'empty') {
    bodyMessage = <StateBlock state={resolved} size="region" />
  } else if (resolved.kind === 'ready' && rows.length === 0) {
    bodyMessage = <StateBlock state={NO_MATCHES_EMPTY} size="region" />
  }

  const densityClass = density === 'compact' ? styles.densityCompact : ''
  const colSpan =
    columns.length + (hasSelection ? 1 : 0) + (hasActions && rowActions !== undefined ? 1 : 0)

  return (
    <div
      className={`${styles.root} ${densityClass}`}
      role="region"
      aria-labelledby={labelId}
      data-table-region
      onKeyDown={handleTableKeyDown}
    >
      <h2 id={labelId} className={SR_ONLY_CLASS}>
        {caption}
      </h2>

      {toolbar}

      <div
        ref={scrollRef}
        className={styles.scroll}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? 'region' : undefined}
        aria-labelledby={scrollable ? labelId : undefined}
      >
        <table className={styles.table}>
          <caption className={SR_ONLY_CLASS}>{caption}</caption>
          <thead>
            <tr>
              {hasSelection ? (
                <th
                  scope="col"
                  className={`${styles.headerCell} ${styles.selectHeader}${
                    stickyHeader ? ` ${styles.headerCellSticky}` : ''
                  }`}
                >
                  <Checkbox
                    ref={headerCheckboxRef}
                    id={headerCheckboxId}
                    checked={allPageSelected}
                    indeterminate={somePageSelected}
                    onChange={(checked) => handleSelectAll(checked)}
                    label="Select all rows on this page"
                    labelHidden
                    disabled={isLoading || selectablePageKeys.length === 0}
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const ariaSort = ariaSortValue(column.id, sort, column.sortable)
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={[
                      styles.headerCell,
                      stickyHeader ? styles.headerCellSticky : '',
                      column.numeric === true ? styles.headerCellNumeric : '',
                      hideBelowClass(column.hideBelow),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={column.width !== undefined ? { width: column.width } : undefined}
                  >
                    {column.headerHidden === true ? (
                      <span className={SR_ONLY_CLASS}>{column.header}</span>
                    ) : (
                      <ColumnHeaderButton
                        header={column.header}
                        sortable={column.sortable === true && onSortChange !== undefined}
                        sortDirection={sortDirectionFor(column.id, sort)}
                        onToggleSort={() => toggleSort(column.id)}
                        numeric={column.numeric === true}
                      />
                    )}
                  </th>
                )
              })}
              {rowActions !== undefined ? (
                <th
                  scope="col"
                  className={`${styles.headerCell}${stickyHeader ? ` ${styles.headerCellSticky}` : ''}`}
                >
                  <span className={SR_ONLY_CLASS}>Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody aria-busy={isLoading ? true : undefined}>
            {isLoading ? (
              <TableSkeletonRows
                columns={columns}
                skeletonRows={skeletonRows}
                hasSelection={hasSelection}
                hasActions={rowActions !== undefined}
                label={resolved.label ?? entityLabel}
              />
            ) : showBodyMessage ? (
              <tr>
                <td colSpan={Math.max(colSpan, 1)} className={styles.bodyMessage}>
                  {bodyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row)
                const selected = selection?.selectedKeys.has(key) === true
                const active = activeRowKey === key
                const selectable = selection?.selectableRow?.(row) !== false
                const rowClass = [
                  styles.row,
                  selected ? styles.rowSelected : '',
                  active ? styles.rowActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <tr key={key} className={rowClass} aria-current={active ? 'true' : undefined}>
                    {hasSelection ? (
                      <td className={styles.selectCell}>
                        <Checkbox
                          id={`${headerCheckboxId}-${key}`}
                          checked={selected}
                          onChange={(checked, event) => {
                            handleRowCheckboxChange(row, checked, event)
                          }}
                          label={`Select ${selection.rowLabel(row)}`}
                          labelHidden
                          disabled={!selectable}
                        />
                      </td>
                    ) : null}
                    {columns.map((column, columnIndex) => {
                      const isRowHeader = columnIndex === 0
                      const cellClass = [
                        column.numeric === true ? `${styles.cellNumeric} numeric` : '',
                        hideBelowClass(column.hideBelow),
                      ]
                        .filter(Boolean)
                        .join(' ')

                      const content = renderCellContent({
                        column,
                        row,
                        isRowHeader,
                        onRowActivate,
                      })

                      if (isRowHeader) {
                        return (
                          <th key={column.id} scope="row" className={cellClass}>
                            {content}
                          </th>
                        )
                      }

                      return (
                        <td key={column.id} className={cellClass}>
                          {content}
                        </td>
                      )
                    })}
                    {rowActions !== undefined ? <td>{rowActions(row)}</td> : null}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination !== undefined ? (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          loading={isLoading}
        />
      ) : null}
    </div>
  )
}

function renderCellContent<Row>({
  column,
  row,
  isRowHeader,
  onRowActivate,
}: {
  readonly column: Column<Row>
  readonly row: Row
  readonly isRowHeader: boolean
  readonly onRowActivate: ((row: Row) => void) | undefined
}): ReactNode {
  const rendered = column.cell(row)

  if (isRowHeader && onRowActivate !== undefined) {
    return (
      <button
        type="button"
        className={`${styles.rowActivate} text-body`}
        onClick={() => onRowActivate(row)}
      >
        {rendered}
      </button>
    )
  }

  return rendered
}
