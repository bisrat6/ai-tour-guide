import { useMemo, useState, type ReactElement } from 'react'

import {
  DataTable,
  Field,
  Panel,
  ProvenanceTag,
  Select,
  StatusBadge,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import {
  SPEND_FIXTURES,
  SPEND_STATUS_OPTIONS,
  SPEND_WINDOW_OPTIONS,
  formatSpend,
  spendForWindow,
  totalSpend,
  type SpendRecord,
  type SpendStatusFilter,
  type SpendWindow,
} from './phase9Fixtures.ts'
import { fleetStatusLabel, fleetStatusTone } from './fleetFixtures.ts'
import styles from './OperatorPhase9Pages.module.css'

export function SpendPage(): ReactElement {
  const [windowKey, setWindowKey] = useState<SpendWindow>('30d')
  const [statusFilter, setStatusFilter] = useState<SpendStatusFilter>('all')

  const filteredRows = useMemo(
    () => SPEND_FIXTURES.filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter)),
    [statusFilter],
  )

  const total = useMemo(() => totalSpend(filteredRows, windowKey), [filteredRows, windowKey])

  const columns = useMemo<readonly Column<SpendRecord>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Tenant',
        sortable: true,
        sortValue: (row) => row.tenantName,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="museum-name">{row.tenantName}</span>
            <span className={`text-caption ${styles.muted}`}>{row.region}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => fleetStatusLabel(row.status),
        cell: (row) => <StatusBadge tone={fleetStatusTone(row.status)} label={fleetStatusLabel(row.status)} />,
      },
      {
        id: 'spend',
        header: 'Spend',
        sortable: true,
        numeric: true,
        sortValue: (row) => spendForWindow(row, windowKey),
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="text-body numeric">{formatSpend(spendForWindow(row, windowKey))}</span>
            <span className={`text-caption ${styles.demoText}`}>Demo attribution</span>
          </div>
        ),
      },
      {
        id: 'share',
        header: 'Tenant share',
        sortable: true,
        sortValue: (row) => spendForWindow(row, windowKey),
        cell: (row) => {
          const share = total === 0 ? 0 : (spendForWindow(row, windowKey) / total) * 100
          return <span className="text-body numeric">{share.toFixed(1)}%</span>
        },
      },
    ],
    [total, windowKey],
  )

  const table = useDataTable({
    rows: filteredRows,
    rowKey: (row) => row.tenantId,
    columns,
    pageSize: 8,
    searchFields: [(row) => row.tenantName, (row) => row.region],
    initialSort: { columnId: 'spend', direction: 'descending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div>
            <h1 className="text-title">Spend</h1>
            <p className={`text-body ${styles.muted}`}>
              Per-tenant spend attribution with sortable breakdown by tenant and status.
            </p>
            <p className={styles.provenanceRow}>
              <ProvenanceTag provenance="demo" note="Billing integration pending" />
            </p>
          </div>
          <div>
            <p className={`column-header ${styles.muted}`}>Selected window total</p>
            <p className="text-subtitle numeric">{formatSpend(total)}</p>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <Field id="spend-window" label="Time window">
            {(control) => (
              <Select
                {...control}
                value={windowKey}
                onChange={(value) => setWindowKey(value as SpendWindow)}
                options={SPEND_WINDOW_OPTIONS}
              />
            )}
          </Field>
          <Field id="spend-status-filter" label="Status filter">
            {(control) => (
              <Select
                {...control}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as SpendStatusFilter)}
                options={SPEND_STATUS_OPTIONS}
              />
            )}
          </Field>
        </div>
      </header>

      <Panel>
        <DataTable
          caption="Per-tenant spend attribution"
          columns={columns}
          rows={table.pageRows}
          rowKey={(row) => row.tenantId}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={table.pagination}
          toolbar={
            <TableToolbar
              searchValue={table.searchQuery}
              onSearchChange={table.setSearchQuery}
              searchLabel="Search tenant spend"
              searchPlaceholder="Search by tenant or region"
              actions={<p className="text-caption">{table.total} tenants in this view</p>}
            />
          }
          stickyHeader
        />
      </Panel>
    </div>
  )
}
