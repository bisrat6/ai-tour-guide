/**
 * This museum's change history, read from `GET /admin/audit-logs`.
 *
 * The route scopes itself: a museum admin's token narrows it whatever is asked
 * for, and passing the active museum narrows a system admin working inside a
 * tenant to the same view. So the "no cross-tenant records here" promise the
 * page makes is the server's, not this component's.
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'

import * as api from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import {
  DataTable,
  Panel,
  StateBlock,
  StatusBadge,
  TableToolbar,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import { useActiveMuseumId } from '../auth/useActiveMuseumId.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import { useScopedTenantContext } from '../operator/scopedTenantContext.tsx'
import {
  auditActorLabel,
  auditActorTone,
  auditPhrase,
  toAuditRow,
  type AuditRow,
} from '../operator/auditLogMapping.ts'
import { useTenantSettingsStore } from '../settings/settingsStore.ts'
import { TENANT_ACTIVITY_ENTRIES } from './activityFixtures.ts'
import styles from './ActivityPage.module.css'

const PAGE_SIZE = 200

/** Demo mode has no trail to read, so the fixtures stand in, shaped the same way. */
const DEMO_ROWS: readonly AuditRow[] = TENANT_ACTIVITY_ENTRIES.map((entry, index) => ({
  id: entry.id,
  museumId: 'museum-adwa',
  museumName: 'Adwa Memorial Museum',
  actor: entry.actor,
  actorKind: entry.actorRole === 'system_operator' ? 'system' : 'admin',
  action: 'UPDATE',
  entityType: entry.target,
  entityId: entry.target,
  happenedAt: new Date(Date.now() - (index + 1) * 3600_000).toISOString(),
}))

function formatTimestamp(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return at.toISOString().slice(0, 16).replace('T', ' ')
}

export function ActivityPage(): ReactElement {
  const scoped = useScopedTenantContext()
  const museumId = useActiveMuseumId()
  const { value: settings } = useTenantSettingsStore()

  const [rows, setRows] = useState<readonly AuditRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    isLiveApi ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!isLiveApi) return

    let current = true
    setStatus('loading')
    setLoadError(null)

    api
      .listAuditLogs({ museumId, limit: PAGE_SIZE })
      .then((page) => {
        if (!current) return
        setRows(page.data.map(toAuditRow))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setRows([])
        setStatus('error')
        setLoadError(isApiError(error) ? error.message : 'Could not load this museum’s activity.')
      })

    return () => {
      current = false
    }
  }, [museumId, reloadToken])

  const visibleRows = isLiveApi ? rows : DEMO_ROWS

  const columns = useMemo<readonly Column<AuditRow>[]>(
    () => [
      {
        id: 'actor',
        header: 'Actor',
        sortable: true,
        sortValue: (entry) => entry.actor,
        cell: (entry) => (
          <span className={styles.actorCell}>
            <span className="text-body">{entry.actor}</span>
            <StatusBadge
              tone={auditActorTone(entry.actorKind)}
              label={auditActorLabel(entry.actorKind)}
            />
          </span>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        sortable: true,
        sortValue: (entry) => auditPhrase(entry.action, entry.entityType),
        cell: (entry) => (
          <span className="text-body">{auditPhrase(entry.action, entry.entityType)}</span>
        ),
      },
      {
        id: 'target',
        header: 'Target',
        sortable: true,
        sortValue: (entry) => entry.entityId,
        cell: (entry) => <span className="text-body">{entry.entityId}</span>,
      },
      {
        id: 'when',
        header: 'Time',
        sortable: true,
        sortValue: (entry) => Date.parse(entry.happenedAt) || 0,
        cell: (entry) => (
          <span className={`text-caption ${styles.muted}`}>{formatTimestamp(entry.happenedAt)}</span>
        ),
      },
    ],
    [],
  )

  const table = useDataTable({
    rows: visibleRows,
    rowKey: (entry) => entry.id,
    columns,
    pageSize: 10,
    searchFields: [
      (entry) => entry.actor,
      (entry) => entry.entityType,
      (entry) => entry.entityId,
    ],
    initialSort: { columnId: 'when', direction: 'descending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">{isLiveApi ? settings.museum.museumName : 'Adwa Memorial Museum'}</p>
          <h1 className="text-title">Activity</h1>
          <p className={`text-body ${styles.muted}`}>
            Tenant-only change history. The server scopes this to one museum, so no cross-tenant
            records can appear here.
          </p>
          {scoped.isScoped ? (
            <p className={`text-caption ${styles.muted}`}>
              Scoped operator context: writes attributed to {scoped.operatorEmail}.
            </p>
          ) : null}
          {isLiveApi ? null : (
            <DemoDataNote>
              No API is configured, so this history is fixtures.
            </DemoDataNote>
          )}
        </div>
      </header>

      {status === 'loading' ? <StateBlock state={{ kind: 'loading', label: 'activity' }} /> : null}

      {status === 'error' ? (
        <StateBlock
          state={{
            kind: 'failure',
            title: 'Activity did not load',
            body: loadError ?? 'The request failed.',
            retry: { label: 'Try again', onAct: reload },
          }}
        />
      ) : null}

      {status === 'ready' ? (
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
                searchPlaceholder="Search by actor, entity, or id"
                actions={<p className="text-caption">{table.total} change records</p>}
              />
            }
            stickyHeader
          />
        </Panel>
      ) : null}
    </div>
  )
}
