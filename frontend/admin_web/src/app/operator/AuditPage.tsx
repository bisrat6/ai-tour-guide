import { useMemo, useState, type ReactElement } from 'react'

import {
  DataTable,
  Field,
  Panel,
  Select,
  StatusBadge,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_FIXTURES,
  AUDIT_WINDOW_OPTIONS,
  auditActionLabel,
  auditSourceLabel,
  auditSourceTone,
  type AuditAction,
  type AuditEntry,
} from './phase9Fixtures.ts'
import styles from './OperatorPhase9Pages.module.css'

type TimeWindowFilter = '24h' | '7d' | '30d' | 'all'

function parseAuditTime(value: string): number {
  return Date.parse(value.replace(' ', 'T'))
}

function withinWindow(timestamp: number, windowFilter: TimeWindowFilter): boolean {
  if (windowFilter === 'all') return true
  const now = Date.parse('2026-07-25T16:30:00')
  const ageMs = now - timestamp
  if (windowFilter === '24h') return ageMs <= 24 * 60 * 60 * 1000
  if (windowFilter === '7d') return ageMs <= 7 * 24 * 60 * 60 * 1000
  return ageMs <= 30 * 24 * 60 * 60 * 1000
}

export function AuditPage(): ReactElement {
  const [tenantFilter, setTenantFilter] = useState<string>('all')
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all')
  const [windowFilter, setWindowFilter] = useState<TimeWindowFilter>('7d')

  const tenantOptions = useMemo(
    () => [
      { value: 'all', label: 'All tenants' },
      ...Array.from(new Set(AUDIT_FIXTURES.map((entry) => entry.tenantId))).map((tenantId) => ({
        value: tenantId,
        label: AUDIT_FIXTURES.find((entry) => entry.tenantId === tenantId)?.tenantName ?? tenantId,
      })),
    ],
    [],
  )

  const actorOptions = useMemo(
    () => [
      { value: 'all', label: 'All actors' },
      ...Array.from(new Set(AUDIT_FIXTURES.map((entry) => entry.actor))).map((actor) => ({ value: actor, label: actor })),
    ],
    [],
  )

  const rows = useMemo(
    () =>
      AUDIT_FIXTURES.filter((entry) => {
        if (tenantFilter !== 'all' && entry.tenantId !== tenantFilter) return false
        if (actorFilter !== 'all' && entry.actor !== actorFilter) return false
        if (actionFilter !== 'all' && entry.action !== actionFilter) return false
        return withinWindow(parseAuditTime(entry.happenedAt), windowFilter)
      }),
    [actionFilter, actorFilter, tenantFilter, windowFilter],
  )

  const columns = useMemo<readonly Column<AuditEntry>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Tenant',
        sortable: true,
        sortValue: (entry) => entry.tenantName,
        cell: (entry) => (
          <div className={styles.rowMeta}>
            <span className="museum-name">{entry.tenantName}</span>
            <span className={`text-caption ${styles.muted}`}>{entry.tenantId}</span>
          </div>
        ),
      },
      {
        id: 'actor',
        header: 'Actor',
        sortable: true,
        sortValue: (entry) => entry.actor,
        cell: (entry) => <span className="text-body">{entry.actor}</span>,
      },
      {
        id: 'action',
        header: 'Action',
        sortable: true,
        sortValue: (entry) => auditActionLabel(entry.action),
        cell: (entry) => <span className="text-body">{auditActionLabel(entry.action)}</span>,
      },
      {
        id: 'detail',
        header: 'Change detail',
        sortable: false,
        cell: (entry) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{entry.detail}</span>
            <span className={`text-caption ${styles.muted}`}>{entry.target}</span>
          </div>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        sortable: true,
        sortValue: (entry) => auditSourceLabel(entry.source),
        cell: (entry) => <StatusBadge tone={auditSourceTone(entry.source)} label={auditSourceLabel(entry.source)} />,
      },
      {
        id: 'time',
        header: 'Time',
        sortable: true,
        sortValue: (entry) => entry.happenedAt,
        cell: (entry) => <span className={`text-caption ${styles.monoDate}`}>{entry.happenedAt}</span>,
      },
    ],
    [],
  )

  const table = useDataTable({
    rows,
    rowKey: (entry) => entry.id,
    columns,
    pageSize: 10,
    searchFields: [(entry) => entry.tenantName, (entry) => entry.actor, (entry) => entry.detail, (entry) => entry.target],
    initialSort: { columnId: 'time', direction: 'descending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <h1 className="text-title">Audit</h1>
        <p className={`text-body ${styles.muted}`}>
          Cross-tenant change history across tenant admins and platform operators.
        </p>
        <p className={`text-caption ${styles.muted}`}>
          Includes scoped operator writes from Phase 8 tenant support flows.
        </p>
      </header>

      <section className={styles.formCard}>
        <div className={styles.filtersRow}>
          <Field id="audit-tenant-filter" label="Tenant">
            {(control) => (
              <Select
                {...control}
                value={tenantFilter}
                onChange={(value) => setTenantFilter(value)}
                options={tenantOptions}
              />
            )}
          </Field>
          <Field id="audit-actor-filter" label="Actor">
            {(control) => (
              <Select
                {...control}
                value={actorFilter}
                onChange={(value) => setActorFilter(value)}
                options={actorOptions}
              />
            )}
          </Field>
          <Field id="audit-action-filter" label="Action">
            {(control) => (
              <Select
                {...control}
                value={actionFilter}
                onChange={(value) => setActionFilter(value as AuditAction | 'all')}
                options={AUDIT_ACTION_OPTIONS}
              />
            )}
          </Field>
          <Field id="audit-window-filter" label="Time window">
            {(control) => (
              <Select
                {...control}
                value={windowFilter}
                onChange={(value) => setWindowFilter(value as TimeWindowFilter)}
                options={AUDIT_WINDOW_OPTIONS}
              />
            )}
          </Field>
        </div>
      </section>

      <Panel>
        <DataTable
          caption="Cross-tenant audit history"
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
              searchLabel="Search audit"
              searchPlaceholder="Search tenant, actor, or target"
              actions={<p className="text-caption">{table.total} entries in current filter</p>}
            />
          }
          stickyHeader
        />
      </Panel>
    </div>
  )
}
