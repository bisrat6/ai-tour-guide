/**
 * The audit trail, read from `GET /admin/audit-logs`.
 *
 * The trail is deliberately thin: a verb, an entity type, an id, an actor, and
 * a time. It does not carry a human sentence about what changed, so the "change
 * detail" column the fixtures had is gone rather than invented — the entity id
 * is shown instead, which is the thing you would actually search for.
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'

import * as api from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import {
  DataTable,
  Field,
  Panel,
  Select,
  StateBlock,
  StatusBadge,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import {
  auditActorLabel,
  auditActorTone,
  auditPhrase,
  toAuditRow,
  type AuditRow,
} from './auditLogMapping.ts'
import { AUDIT_WINDOW_OPTIONS } from './phase9Fixtures.ts'
import { useFleetStore } from './fleetStore.tsx'
import styles from './OperatorPhase9Pages.module.css'

type TimeWindowFilter = '24h' | '7d' | '30d' | 'all'

const WINDOW_MS: Readonly<Record<Exclude<TimeWindowFilter, 'all'>, number>> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/** Deep enough that the window filter has something to narrow. */
const PAGE_SIZE = 200

function withinWindow(happenedAt: string, windowFilter: TimeWindowFilter): boolean {
  if (windowFilter === 'all') return true
  const at = Date.parse(happenedAt)
  if (Number.isNaN(at)) return true
  return Date.now() - at <= WINDOW_MS[windowFilter]
}

function formatTimestamp(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return at.toISOString().slice(0, 16).replace('T', ' ')
}

export function AuditPage(): ReactElement {
  const { museums } = useFleetStore()

  const [rows, setRows] = useState<readonly AuditRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    isLiveApi ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [tenantFilter, setTenantFilter] = useState<string>('all')
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [windowFilter, setWindowFilter] = useState<TimeWindowFilter>('7d')

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!isLiveApi) return

    let current = true
    setStatus('loading')
    setLoadError(null)

    api
      .listAuditLogs({ limit: PAGE_SIZE })
      .then((page) => {
        if (!current) return
        setRows(page.data.map(toAuditRow))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setRows([])
        setStatus('error')
        setLoadError(isApiError(error) ? error.message : 'Could not load the audit trail.')
      })

    return () => {
      current = false
    }
  }, [reloadToken])

  /**
   * Named from the fleet where possible, so a tenant with no activity in the
   * window is still selectable rather than vanishing from the filter.
   */
  const tenantOptions = useMemo(() => {
    const fromFleet = museums.map((museum) => ({ value: museum.id, label: museum.name }))
    const known = new Set(fromFleet.map((option) => option.value))
    const fromRows = rows
      .filter((row) => row.museumId !== null && !known.has(row.museumId))
      .map((row) => ({ value: row.museumId as string, label: row.museumName }))
    return [{ value: 'all', label: 'All tenants' }, ...fromFleet, ...fromRows]
  }, [museums, rows])

  const actorOptions = useMemo(
    () => [
      { value: 'all', label: 'All actors' },
      ...Array.from(new Set(rows.map((row) => row.actor))).map((actor) => ({
        value: actor,
        label: actor,
      })),
    ],
    [rows],
  )

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (tenantFilter !== 'all' && row.museumId !== tenantFilter) return false
        if (actorFilter !== 'all' && row.actor !== actorFilter) return false
        return withinWindow(row.happenedAt, windowFilter)
      }),
    [actorFilter, rows, tenantFilter, windowFilter],
  )

  const columns = useMemo<readonly Column<AuditRow>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Tenant',
        sortable: true,
        sortValue: (row) => row.museumName,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="museum-name">{row.museumName}</span>
            <span className={`text-caption ${styles.muted}`}>{row.museumId ?? '—'}</span>
          </div>
        ),
      },
      {
        id: 'actor',
        header: 'Actor',
        sortable: true,
        sortValue: (row) => row.actor,
        cell: (row) => <span className="text-body">{row.actor}</span>,
      },
      {
        id: 'action',
        header: 'Action',
        sortable: true,
        sortValue: (row) => auditPhrase(row.action, row.entityType),
        cell: (row) => <span className="text-body">{auditPhrase(row.action, row.entityType)}</span>,
      },
      {
        id: 'entity',
        header: 'Entity',
        sortable: false,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{row.entityType}</span>
            <span className={`text-caption ${styles.monoDate}`}>{row.entityId}</span>
          </div>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        sortable: true,
        sortValue: (row) => auditActorLabel(row.actorKind),
        cell: (row) => (
          <StatusBadge
            tone={auditActorTone(row.actorKind)}
            label={auditActorLabel(row.actorKind)}
          />
        ),
      },
      {
        id: 'time',
        header: 'Time',
        sortable: true,
        sortValue: (row) => Date.parse(row.happenedAt) || 0,
        cell: (row) => (
          <span className={`text-caption ${styles.monoDate}`}>
            {formatTimestamp(row.happenedAt)}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useDataTable({
    rows: filtered,
    rowKey: (row) => row.id,
    columns,
    pageSize: 10,
    searchFields: [
      (row) => row.museumName,
      (row) => row.actor,
      (row) => row.entityType,
      (row) => row.entityId,
    ],
    initialSort: { columnId: 'time', direction: 'descending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <h1 className="text-title">Audit</h1>
        <p className={`text-body ${styles.muted}`}>
          Every admin mutation, newest first, across tenant admins and platform operators.
        </p>
        {isLiveApi ? null : (
          <DemoDataNote>
            No API is configured, so there is no trail to read. Point VITE_API_BASE_URL at the
            backend to see real activity.
          </DemoDataNote>
        )}
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

      {status === 'loading' ? <StateBlock state={{ kind: 'loading', label: 'the audit trail' }} /> : null}

      {status === 'error' ? (
        <StateBlock
          state={{
            kind: 'failure',
            title: 'The audit trail did not load',
            body: loadError ?? 'The request failed.',
            retry: { label: 'Try again', onAct: reload },
          }}
        />
      ) : null}

      {status === 'ready' ? (
        <Panel>
          <DataTable
            caption="Cross-tenant audit history"
            columns={columns}
            rows={table.pageRows}
            rowKey={(row) => row.id}
            sort={table.sort}
            onSortChange={table.setSort}
            pagination={table.pagination}
            toolbar={
              <TableToolbar
                searchValue={table.searchQuery}
                onSearchChange={table.setSearchQuery}
                searchLabel="Search audit"
                searchPlaceholder="Search tenant, actor, or entity"
                actions={<p className="text-caption">{table.total} entries in current filter</p>}
              />
            }
            stickyHeader
          />
        </Panel>
      ) : null}
    </div>
  )
}
