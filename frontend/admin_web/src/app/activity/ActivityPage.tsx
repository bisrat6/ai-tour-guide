import { useMemo, type ReactElement } from 'react'

import { DataTable, Panel, StatusBadge, TableToolbar, useDataTable, type Column } from '../../kit/index.ts'
import { TENANT_ACTIVITY_ENTRIES, type ActivityEntry } from './activityFixtures.ts'
import { useScopedTenantContext } from '../operator/scopedTenantContext.tsx'
import styles from './ActivityPage.module.css'

export function ActivityPage(): ReactElement {
  const scoped = useScopedTenantContext()
  const columns = useMemo<readonly Column<ActivityEntry>[]>(
    () => [
      {
        id: 'actor',
        header: 'Actor',
        sortable: true,
        sortValue: (entry) => entry.actor,
        cell: (entry) => (
          <span className={styles.actorCell}>
            <span className="text-body">{entry.actor}</span>
            {scoped.isScoped && entry.actorRole === 'system_operator' ? (
              <StatusBadge tone="warning" label="Operator scoped write" marker="ring" />
            ) : null}
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        sortable: true,
        sortValue: (entry) => entry.action,
        cell: (entry) => <span className="text-body">{entry.action}</span>,
      },
      {
        id: 'target',
        header: 'Target',
        sortable: true,
        sortValue: (entry) => entry.target,
        cell: (entry) => <span className="text-body">{entry.target}</span>,
      },
      {
        id: 'when',
        header: 'Time',
        sortable: true,
        sortValue: (entry) => entry.when,
        cell: (entry) => <span className={`text-caption ${styles.muted}`}>{entry.when}</span>,
      },
    ],
    [scoped.isScoped],
  )

  const table = useDataTable({
    rows: TENANT_ACTIVITY_ENTRIES,
    rowKey: (entry) => entry.id,
    columns,
    pageSize: 10,
    searchFields: [(entry) => entry.actor, (entry) => entry.action, (entry) => entry.target],
    initialSort: { columnId: 'when', direction: 'descending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Activity</h1>
          <p className={`text-body ${styles.muted}`}>
            Tenant-only change history. No cross-tenant records are displayed in this route.
          </p>
          {scoped.isScoped ? (
            <p className={`text-caption ${styles.muted}`}>
              Scoped operator context: writes attributed to {scoped.operatorEmail}.
            </p>
          ) : null}
        </div>
      </header>

      <Panel>
        <DataTable
          caption="Museum activity history"
          columns={columns}
          rows={table.pageRows}
          rowKey={(entry) => entry.id}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={table.pagination}
          toolbar={
            <TableToolbar
              searchValue={table.searchQuery}
              onSearchChange={table.setSearchQuery}
              searchLabel="Search activity"
              searchPlaceholder="Search by actor, action, or target"
              actions={<p className="text-caption">{table.total} change records</p>}
            />
          }
          stickyHeader
        />
      </Panel>
    </div>
  )
}
