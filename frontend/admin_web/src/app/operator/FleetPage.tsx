import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  BulkActionBar,
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PeekPanel,
  Select,
  StatusBadge,
  StatusMarkerGlyph,
  TableToolbar,
  TextInput,
  useDataTable,
  type Column,
  type StatusMarker,
} from '../../kit/index.ts'
import { useFleetStore } from './fleetStore.tsx'
import {
  FLEET_STATUS_OPTIONS,
  fleetHealthLabel,
  fleetHealthTone,
  fleetStatusLabel,
  fleetStatusTone,
  formatUsd,
  type FleetMuseum,
  type FleetStatus,
} from './fleetFixtures.ts'
import styles from './FleetPage.module.css'

type PendingStatusChange = {
  readonly museumId: string
  readonly nextStatus: FleetStatus
}

type OnboardDraft = {
  readonly name: string
  readonly region: string
  readonly roomCount: string
}

function useSheetMode(): boolean {
  const [sheet, setSheet] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024
  })

  useEffect(() => {
    function onResize(): void {
      setSheet(window.innerWidth < 1024)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return sheet
}

function readinessAttentionCount(readiness: readonly { marker: StatusMarker }[]): number {
  return readiness.filter((segment) => segment.marker === 'ring' || segment.marker === 'cross').length
}

function markerClass(marker: StatusMarker): string {
  if (marker === 'dot') return styles.segmentSuccess
  if (marker === 'ring') return styles.segmentWarning
  if (marker === 'cross') return styles.segmentDanger
  return styles.segmentNeutral
}

function MiniReadinessSpine({ museum }: { readonly museum: FleetMuseum }): ReactElement {
  return (
    <ol className={styles.spine} aria-label={`${museum.name} readiness spine`}>
      {museum.readiness.map((segment) => (
        <li key={segment.id} className={`${styles.spineSegment} ${markerClass(segment.marker)}`}>
          <StatusMarkerGlyph marker={segment.marker} size={12} />
        </li>
      ))}
    </ol>
  )
}

export function FleetPage(): ReactElement {
  const {
    museums,
    fleetUi,
    setFleetView,
    setFleetSearch,
    setFleetStatusFilter,
    setFleetScrollY,
    onboardMuseum,
    setMuseumStatus,
  } = useFleetStore()
  const navigate = useNavigate()
  const location = useLocation()
  const prefersSheet = useSheetMode()

  const [selectedMuseumId, setSelectedMuseumId] = useState<string | null>(null)
  const [activePeekTabId, setActivePeekTabId] = useState('summary')
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [onboardDraft, setOnboardDraft] = useState<OnboardDraft>({ name: '', region: '', roomCount: '4' })
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (location.pathname.endsWith('/fleet/new')) {
      setOnboardOpen(true)
    }
  }, [location.pathname])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: fleetUi.scrollY, behavior: 'auto' })
  }, [fleetUi.scrollY])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = (): void => {
      setFleetScrollY(window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [setFleetScrollY])

  const filteredMuseums = useMemo(() => {
    const needle = fleetUi.search.trim().toLowerCase()
    return museums.filter((museum) => {
      if (fleetUi.statusFilter !== 'all' && museum.status !== fleetUi.statusFilter) return false
      if (needle.length === 0) return true
      return `${museum.name} ${museum.region}`.toLowerCase().includes(needle)
    })
  }, [fleetUi.search, fleetUi.statusFilter, museums])

  const attentionCount = useMemo(
    () =>
      museums.filter(
        (museum) =>
          museum.status !== 'active' || museum.health !== 'healthy' || readinessAttentionCount(museum.readiness) > 0,
      ).length,
    [museums],
  )

  const columns = useMemo<readonly Column<FleetMuseum>[]>(
    () => [
      {
        id: 'museum',
        header: 'Museum',
        sortable: true,
        sortValue: (museum) => museum.name,
        cell: (museum) => (
          <div className={styles.tableName}>
            <span className="museum-name">{museum.name}</span>
            <span className={`text-caption ${styles.muted}`}>{museum.region}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (museum) => fleetStatusLabel(museum.status),
        cell: (museum) => <StatusBadge tone={fleetStatusTone(museum.status)} label={fleetStatusLabel(museum.status)} />,
      },
      {
        id: 'readiness',
        header: 'Spine',
        sortable: true,
        sortValue: (museum) => readinessAttentionCount(museum.readiness),
        cell: (museum) => <MiniReadinessSpine museum={museum} />,
      },
      {
        id: 'spend',
        header: 'Spend',
        numeric: true,
        sortable: true,
        sortValue: (museum) => museum.spendMonthlyUsd,
        cell: (museum) => (
          <div className={styles.tableSpend}>
            <span className="numeric">{formatUsd(museum.spendMonthlyUsd)}</span>
            <span className={`text-caption ${styles.demoText}`}>Demo monthly</span>
          </div>
        ),
      },
      {
        id: 'health',
        header: 'Health',
        sortable: true,
        sortValue: (museum) => fleetHealthLabel(museum.health),
        cell: (museum) => <StatusBadge tone={fleetHealthTone(museum.health)} label={fleetHealthLabel(museum.health)} />,
      },
      {
        id: 'updated',
        header: 'Updated',
        sortable: true,
        sortValue: (museum) => museum.updatedAt,
        cell: (museum) => <span className={`text-caption ${styles.muted}`}>{museum.updatedAt}</span>,
      },
    ],
    [],
  )

  const table = useDataTable({
    rows: filteredMuseums,
    rowKey: (museum) => museum.id,
    columns,
    pageSize: 8,
    initialSort: { columnId: 'spend', direction: 'descending' },
  })

  const selectedMuseum = useMemo(
    () => museums.find((museum) => museum.id === selectedMuseumId) ?? null,
    [museums, selectedMuseumId],
  )

  function openPeek(museum: FleetMuseum, trigger: HTMLElement): void {
    returnFocusTo.current = trigger
    setSelectedMuseumId(museum.id)
    setActivePeekTabId('summary')
  }

  function openStatusChange(museum: FleetMuseum, trigger: HTMLElement): void {
    returnFocusTo.current = trigger
    setPendingStatusChange({
      museumId: museum.id,
      nextStatus: museum.status === 'suspended' ? 'active' : 'suspended',
    })
  }

  function confirmStatusChange(): void {
    if (pendingStatusChange === null) return
    setMuseumStatus(pendingStatusChange.museumId, pendingStatusChange.nextStatus)
    setPendingStatusChange(null)
  }

  function enterTenant(museumId: string): void {
    if (typeof window !== 'undefined') {
      setFleetScrollY(window.scrollY)
    }
    navigate(`/operator/tenant/${museumId}/overview`)
  }

  const bulkActions = [
    {
      id: 'suspend-selected',
      label: 'Suspend selected',
      tone: 'danger' as const,
      confirm: {
        title: 'Suspend selected museums',
        consequence: 'will be suspended. Public content disappears until you reinstate.',
        confirmLabel: 'Suspend',
      },
      onAct: (keys: ReadonlySet<string>) => {
        for (const museumId of keys) setMuseumStatus(museumId, 'suspended')
        table.clearSelection()
      },
    },
    {
      id: 'reinstate-selected',
      label: 'Reinstate selected',
      onAct: (keys: ReadonlySet<string>) => {
        for (const museumId of keys) setMuseumStatus(museumId, 'active')
        table.clearSelection()
      },
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div>
            <h1 className="text-title">Fleet</h1>
            <p className={`text-body ${styles.muted}`}>
              {museums.length} museums. {attentionCount} need attention from readiness, status, or health.
            </p>
            <p className={`text-caption ${styles.demoText}`}>Spend and health values are fixture demo data.</p>
          </div>
          <div className={styles.headerActions}>
            <Button
              tone={fleetUi.view === 'gallery' ? 'primary' : 'secondary'}
              aria-pressed={fleetUi.view === 'gallery'}
              onClick={() => setFleetView('gallery')}
            >
              Gallery
            </Button>
            <Button
              tone={fleetUi.view === 'table' ? 'primary' : 'secondary'}
              aria-pressed={fleetUi.view === 'table'}
              onClick={() => setFleetView('table')}
            >
              Table
            </Button>
            <Button
              onClick={() => {
                setOnboardOpen(true)
                navigate('/operator/fleet/new')
              }}
            >
              Onboard museum
            </Button>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <Field id="fleet-search" label="Search fleet">
            {(control) => (
              <TextInput
                {...control}
                type="search"
                value={fleetUi.search}
                onChange={setFleetSearch}
                placeholder="Search by museum or region"
                clearable
                shortcutHint="Ctrl+K"
              />
            )}
          </Field>
          <Field id="fleet-status-filter" label="Status filter">
            {(control) => (
              <Select
                {...control}
                value={fleetUi.statusFilter}
                onChange={(value) => setFleetStatusFilter(value as FleetStatus | 'all')}
                options={[{ value: 'all', label: 'All statuses' }, ...FLEET_STATUS_OPTIONS]}
              />
            )}
          </Field>
        </div>
      </header>

      {fleetUi.view === 'gallery' ? (
        <section className={styles.gallery} aria-label="Fleet gallery wall">
          {filteredMuseums.map((museum) => (
            <article key={museum.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={`museum-name ${styles.museumName}`}>{museum.name}</p>
                  <p className={`text-caption ${styles.muted}`}>{museum.region}</p>
                </div>
                <StatusBadge tone={fleetStatusTone(museum.status)} label={fleetStatusLabel(museum.status)} />
              </div>

              <div className={styles.cardMeta}>
                <span className={styles.metric}>
                  <span className={`${styles.metricLabel} text-caption`}>Rooms</span>
                  <span className={`${styles.metricValue} text-body numeric`}>{museum.roomCount}</span>
                </span>
                <span className={styles.metric}>
                  <span className={`${styles.metricLabel} text-caption`}>Spend</span>
                  <span className={`${styles.metricValue} text-body numeric`}>{formatUsd(museum.spendMonthlyUsd)}</span>
                </span>
                <span className={styles.metric}>
                  <span className={`${styles.metricLabel} text-caption`}>Health</span>
                  <span className={`${styles.metricValue} text-body`}>{fleetHealthLabel(museum.health)}</span>
                </span>
              </div>

              <MiniReadinessSpine museum={museum} />

              <div className={styles.cardActions}>
                <Button
                  tone="secondary"
                  compact
                  onClick={() => navigate(`/operator/fleet/${museum.id}`)}
                  aria-label={`Open tenant record for ${museum.name}`}
                >
                  Tenant record
                </Button>
                <Button
                  tone="ghost"
                  compact
                  onClick={() => enterTenant(museum.id)}
                  aria-label={`Enter tenant ${museum.name}`}
                >
                  Enter tenant
                </Button>
                <Button
                  tone="ghost"
                  compact
                  onClick={(event) => openPeek(museum, event.currentTarget)}
                  aria-label={`Peek ${museum.name}`}
                >
                  Peek
                </Button>
                <Button
                  tone={museum.status === 'suspended' ? 'secondary' : 'danger'}
                  compact
                  onClick={(event) => openStatusChange(museum, event.currentTarget)}
                  aria-label={`${museum.status === 'suspended' ? 'Reinstate' : 'Suspend'} ${museum.name}`}
                >
                  {museum.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.tableCard}>
          <DataTable
            caption="Fleet table"
            columns={columns}
            rows={table.pageRows}
            rowKey={(museum) => museum.id}
            sort={table.sort}
            onSortChange={table.setSort}
            pagination={table.pagination}
            selection={{
              selectedKeys: table.selectedKeys,
              onChange: table.setSelectedKeys,
              rowLabel: (museum) => museum.name,
            }}
            onRowActivate={(museum) => navigate(`/operator/fleet/${museum.id}`)}
            activeRowKey={selectedMuseumId}
            toolbar={
              <TableToolbar
                searchValue={fleetUi.search}
                onSearchChange={setFleetSearch}
                searchLabel="Search fleet"
                searchPlaceholder="Search by museum or region"
                actions={<p className="text-caption">{table.total} museums in current view</p>}
              />
            }
            rowActions={(museum) => (
              <div className={styles.rowActions}>
                <Button
                  tone="ghost"
                  compact
                  onClick={(event) => openPeek(museum, event.currentTarget)}
                  aria-label={`Open peek panel for ${museum.name}`}
                >
                  Open
                </Button>
                <Button tone="ghost" compact onClick={() => enterTenant(museum.id)}>
                  Enter
                </Button>
                <Button
                  tone={museum.status === 'suspended' ? 'secondary' : 'danger'}
                  compact
                  onClick={(event) => openStatusChange(museum, event.currentTarget)}
                >
                  {museum.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                </Button>
              </div>
            )}
            stickyHeader
          />

          <BulkActionBar
            selectedKeys={table.selectedKeys}
            noun={{ one: 'museum', many: 'museums' }}
            actions={bulkActions}
            onClear={table.clearSelection}
          />
        </section>
      )}

      <PeekPanel
        open={selectedMuseum !== null}
        title="Museum"
        {...(selectedMuseum !== null ? { museumName: selectedMuseum.name } : {})}
        {...(selectedMuseum !== null
          ? { subtitle: `${selectedMuseum.region} • ${selectedMuseum.roomCount} rooms` }
          : {})}
        {...(selectedMuseum !== null
          ? { status: { tone: fleetStatusTone(selectedMuseum.status), label: fleetStatusLabel(selectedMuseum.status) } }
          : {})}
        tabs={[
          {
            id: 'summary',
            label: 'Summary',
            content:
              selectedMuseum !== null ? (
                <div className={styles.peekSummary}>
                  <p className="text-body">
                    Fleet fixture record for <span className="museum-name">{selectedMuseum.name}</span>.
                  </p>
                  <div className={styles.peekStats}>
                    <div className={styles.peekStat}>
                      <p className={`column-header ${styles.muted}`}>Spend</p>
                      <p className="text-subtitle numeric">{formatUsd(selectedMuseum.spendMonthlyUsd)}</p>
                    </div>
                    <div className={styles.peekStat}>
                      <p className={`column-header ${styles.muted}`}>Health</p>
                      <p className="text-subtitle">{fleetHealthLabel(selectedMuseum.health)}</p>
                    </div>
                  </div>
                </div>
              ) : null,
          },
          {
            id: 'readiness',
            label: 'Readiness',
            content: selectedMuseum !== null ? <MiniReadinessSpine museum={selectedMuseum} /> : null,
          },
          {
            id: 'actions',
            label: 'Actions',
            content: (
              <p className="text-body">
                Use the footer actions to open the full tenant record, enter tenant routing, or update status.
              </p>
            ),
          },
        ]}
        activeTabId={activePeekTabId}
        onTabChange={setActivePeekTabId}
        footer={
          selectedMuseum !== null ? (
            <div className={styles.peekFooter}>
              <Button tone="secondary" onClick={() => navigate(`/operator/fleet/${selectedMuseum.id}`)}>
                Open tenant record
              </Button>
              <Button tone="ghost" onClick={() => enterTenant(selectedMuseum.id)}>
                Enter tenant
              </Button>
            </div>
          ) : undefined
        }
        onClose={() => setSelectedMuseumId(null)}
        returnFocusTo={returnFocusTo}
        variant={prefersSheet ? 'sheet' : 'overlay'}
      />

      <Modal
        open={onboardOpen}
        title="Onboard museum"
        description="Creates a fixture-backed tenant record in onboarding state."
        onClose={() => {
          setOnboardOpen(false)
          if (location.pathname.endsWith('/fleet/new')) navigate('/operator/fleet')
        }}
        footer={
          <>
            <Button
              tone="secondary"
              onClick={() => {
                setOnboardOpen(false)
                if (location.pathname.endsWith('/fleet/new')) navigate('/operator/fleet')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onboardMuseum({
                  name: onboardDraft.name,
                  region: onboardDraft.region,
                  roomCount: Number.parseInt(onboardDraft.roomCount, 10),
                })
                setOnboardDraft({ name: '', region: '', roomCount: '4' })
                setOnboardOpen(false)
                navigate('/operator/fleet')
              }}
              disabled={onboardDraft.name.trim().length === 0}
            >
              Add museum
            </Button>
          </>
        }
      >
        <div className={styles.page}>
          <Field id="onboard-name" label="Museum name" required>
            {(control) => (
              <TextInput
                {...control}
                value={onboardDraft.name}
                onChange={(next) => setOnboardDraft((draft) => ({ ...draft, name: next }))}
                placeholder="Museum name"
              />
            )}
          </Field>
          <Field id="onboard-region" label="Region">
            {(control) => (
              <TextInput
                {...control}
                value={onboardDraft.region}
                onChange={(next) => setOnboardDraft((draft) => ({ ...draft, region: next }))}
                placeholder="Region"
              />
            )}
          </Field>
          <Field id="onboard-rooms" label="Initial room count">
            {(control) => (
              <TextInput
                {...control}
                value={onboardDraft.roomCount}
                onChange={(next) => setOnboardDraft((draft) => ({ ...draft, roomCount: next }))}
                inputMode="numeric"
              />
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingStatusChange !== null}
        title={pendingStatusChange?.nextStatus === 'suspended' ? 'Suspend museum' : 'Reinstate museum'}
        entityName={museums.find((museum) => museum.id === pendingStatusChange?.museumId)?.name ?? 'Museum'}
        consequence={
          pendingStatusChange?.nextStatus === 'suspended'
            ? 'will be suspended. Public content disappears until it is reinstated.'
            : 'will be reinstated. Public content becomes available again.'
        }
        confirmLabel={pendingStatusChange?.nextStatus === 'suspended' ? 'Suspend museum' : 'Reinstate museum'}
        tone={pendingStatusChange?.nextStatus === 'suspended' ? 'danger' : 'primary'}
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingStatusChange(null)}
        returnFocusTo={returnFocusTo}
      />
    </div>
  )
}
