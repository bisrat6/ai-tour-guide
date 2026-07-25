import { useMemo, useState, type FormEvent, type ReactElement } from 'react'

import {
  Button,
  DataTable,
  Field,
  IntegrationPendingPanel,
  Panel,
  Select,
  StatusBadge,
  TableToolbar,
  TextInput,
  useDataTable,
  type Column,
} from '../../kit/index.ts'
import {
  MUSEUM_ADMIN_SEAT_FIXTURES,
  OPERATOR_ADMIN_FIXTURES,
  adminStatusLabel,
  adminStatusTone,
  seatStatusLabel,
  seatStatusTone,
  type AdminStatus,
  type MuseumAdminSeat,
  type OperatorAdminAccount,
  type SeatStatus,
} from './phase9Fixtures.ts'
import styles from './OperatorPhase9Pages.module.css'

type OperatorDraft = {
  readonly name: string
  readonly email: string
}

type SeatDraft = {
  readonly tenantName: string
  readonly personName: string
  readonly email: string
}

export function AdminsPage(): ReactElement {
  const [operators, setOperators] = useState<readonly OperatorAdminAccount[]>(OPERATOR_ADMIN_FIXTURES)
  const [seats, setSeats] = useState<readonly MuseumAdminSeat[]>(MUSEUM_ADMIN_SEAT_FIXTURES)
  const [operatorDraft, setOperatorDraft] = useState<OperatorDraft>({ name: '', email: '' })
  const [seatDraft, setSeatDraft] = useState<SeatDraft>({ tenantName: '', personName: '', email: '' })
  const [seatStatusFilter, setSeatStatusFilter] = useState<SeatStatus | 'all'>('all')

  const operatorColumns = useMemo<readonly Column<OperatorAdminAccount>[]>(
    () => [
      {
        id: 'name',
        header: 'Operator',
        sortable: true,
        sortValue: (row) => row.name,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{row.name}</span>
            <span className={`text-caption ${styles.muted}`}>{row.email}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => adminStatusLabel(row.status),
        cell: (row) => <StatusBadge tone={adminStatusTone(row.status)} label={adminStatusLabel(row.status)} />,
      },
      {
        id: 'lastSeen',
        header: 'Last seen',
        sortable: true,
        sortValue: (row) => row.lastSeen,
        cell: (row) => <span className={`text-caption ${styles.monoDate}`}>{row.lastSeen}</span>,
      },
    ],
    [],
  )

  const seatColumns = useMemo<readonly Column<MuseumAdminSeat>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Tenant',
        sortable: true,
        sortValue: (row) => row.tenantName,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="museum-name">{row.tenantName}</span>
            <span className={`text-caption ${styles.muted}`}>{row.tenantId}</span>
          </div>
        ),
      },
      {
        id: 'admin',
        header: 'Museum admin',
        sortable: true,
        sortValue: (row) => row.personName,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{row.personName}</span>
            <span className={`text-caption ${styles.muted}`}>{row.email}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Seat status',
        sortable: true,
        sortValue: (row) => seatStatusLabel(row.status),
        cell: (row) => <StatusBadge tone={seatStatusTone(row.status)} label={seatStatusLabel(row.status)} />,
      },
      {
        id: 'updated',
        header: 'Updated',
        sortable: true,
        sortValue: (row) => row.updatedAt,
        cell: (row) => <span className={`text-caption ${styles.monoDate}`}>{row.updatedAt}</span>,
      },
    ],
    [],
  )

  const filteredSeats = useMemo(
    () => seats.filter((row) => (seatStatusFilter === 'all' ? true : row.status === seatStatusFilter)),
    [seatStatusFilter, seats],
  )

  const operatorTable = useDataTable({
    rows: operators,
    rowKey: (row) => row.id,
    columns: operatorColumns,
    pageSize: 6,
    searchFields: [(row) => row.name, (row) => row.email],
    initialSort: { columnId: 'name', direction: 'ascending' },
  })

  const seatTable = useDataTable({
    rows: filteredSeats,
    rowKey: (row) => row.id,
    columns: seatColumns,
    pageSize: 6,
    searchFields: [(row) => row.tenantName, (row) => row.personName, (row) => row.email],
    initialSort: { columnId: 'tenant', direction: 'ascending' },
  })

  function addOperator(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const name = operatorDraft.name.trim()
    const email = operatorDraft.email.trim().toLowerCase()
    if (name.length === 0 || email.length === 0) return

    const next: OperatorAdminAccount = {
      id: `op-${Date.now()}`,
      name,
      email,
      status: 'active',
      lastSeen: 'new',
    }
    setOperators((current) => [next, ...current])
    setOperatorDraft({ name: '', email: '' })
  }

  function addSeat(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const tenantName = seatDraft.tenantName.trim()
    const personName = seatDraft.personName.trim()
    const email = seatDraft.email.trim().toLowerCase()
    if (tenantName.length === 0 || personName.length === 0 || email.length === 0) return

    const seat: MuseumAdminSeat = {
      id: `seat-${Date.now()}`,
      tenantId: tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tenantName,
      personName,
      email,
      status: 'invited',
      updatedAt: 'just now',
    }
    setSeats((current) => [seat, ...current])
    setSeatDraft({ tenantName: '', personName: '', email: '' })
  }

  function setOperatorStatus(operatorId: string, status: AdminStatus): void {
    setOperators((current) =>
      current.map((row) => (row.id === operatorId ? { ...row, status, lastSeen: 'just now' } : row)),
    )
  }

  function setSeatStatus(seatId: string, status: SeatStatus): void {
    setSeats((current) => current.map((row) => (row.id === seatId ? { ...row, status, updatedAt: 'just now' } : row)))
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <h1 className="text-title">Admins</h1>
        <p className={`text-body ${styles.muted}`}>
          Fixture-backed admin and seat management for operator workflows.
        </p>
        <p className={`text-caption ${styles.muted}`}>
          Identity-provider provisioning and email delivery remain integration pending.
        </p>
      </header>

      <IntegrationPendingPanel
        dependency="Identity provider + seat email service"
        body="Account lifecycle and invite delivery are shown as fixture-backed operations in this phase."
        stillUsable="You can still create records, suspend/reactivate accounts, and inspect seat coverage behavior."
      />

      <section className={styles.gridTwo}>
        <form className={styles.formCard} onSubmit={addOperator}>
          <p className="text-subtitle">Create operator account</p>
          <div className={styles.formGrid}>
            <Field id="operator-create-name" label="Name" required>
              {(control) => (
                <TextInput
                  {...control}
                  value={operatorDraft.name}
                  onChange={(value) => setOperatorDraft((current) => ({ ...current, name: value }))}
                  placeholder="Operator name"
                />
              )}
            </Field>
            <Field id="operator-create-email" label="Email" required>
              {(control) => (
                <TextInput
                  {...control}
                  value={operatorDraft.email}
                  onChange={(value) => setOperatorDraft((current) => ({ ...current, email: value }))}
                  placeholder="operator@adwa.local"
                  inputMode="email"
                />
              )}
            </Field>
            <div className={styles.statusRow}>
              <Button type="submit">Create operator</Button>
            </div>
          </div>
        </form>

        <form className={styles.formCard} onSubmit={addSeat}>
          <p className="text-subtitle">Create museum-admin seat</p>
          <div className={styles.formGrid}>
            <Field id="seat-create-tenant" label="Tenant" required>
              {(control) => (
                <TextInput
                  {...control}
                  value={seatDraft.tenantName}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, tenantName: value }))}
                  placeholder="Tenant name"
                />
              )}
            </Field>
            <Field id="seat-create-name" label="Name" required>
              {(control) => (
                <TextInput
                  {...control}
                  value={seatDraft.personName}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, personName: value }))}
                  placeholder="Museum admin name"
                />
              )}
            </Field>
            <Field id="seat-create-email" label="Email" required>
              {(control) => (
                <TextInput
                  {...control}
                  value={seatDraft.email}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, email: value }))}
                  placeholder="admin@museum.local"
                  inputMode="email"
                />
              )}
            </Field>
            <div className={styles.statusRow}>
              <Button type="submit">Create seat</Button>
            </div>
          </div>
        </form>
      </section>

      <Panel title="Operator accounts">
        <DataTable
          caption="Operator account list"
          columns={operatorColumns}
          rows={operatorTable.pageRows}
          rowKey={(row) => row.id}
          sort={operatorTable.sort}
          onSortChange={operatorTable.setSort}
          pagination={operatorTable.pagination}
          toolbar={
            <TableToolbar
              searchValue={operatorTable.searchQuery}
              onSearchChange={operatorTable.setSearchQuery}
              searchLabel="Search operators"
              searchPlaceholder="Search by name or email"
              actions={<p className="text-caption">{operatorTable.total} operator accounts</p>}
            />
          }
          rowActions={(row) => (
            <div className={styles.rowActions}>
              {row.status === 'active' ? (
                <Button tone="danger" compact onClick={() => setOperatorStatus(row.id, 'suspended')}>
                  Suspend
                </Button>
              ) : (
                <Button tone="secondary" compact onClick={() => setOperatorStatus(row.id, 'active')}>
                  Reactivate
                </Button>
              )}
            </div>
          )}
          stickyHeader
        />
      </Panel>

      <Panel
        title="Museum-admin seats"
        description="Seats represent tenant-facing admin access and invitation status."
      >
        <div className={styles.filtersRow}>
          <Field id="seat-status-filter" label="Seat status filter">
            {(control) => (
              <Select
                {...control}
                value={seatStatusFilter}
                onChange={(value) => setSeatStatusFilter(value as SeatStatus | 'all')}
                options={[
                  { value: 'all', label: 'All seat statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'invited', label: 'Invited' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
              />
            )}
          </Field>
        </div>
        <DataTable
          caption="Museum admin seats"
          columns={seatColumns}
          rows={seatTable.pageRows}
          rowKey={(row) => row.id}
          sort={seatTable.sort}
          onSortChange={seatTable.setSort}
          pagination={seatTable.pagination}
          toolbar={
            <TableToolbar
              searchValue={seatTable.searchQuery}
              onSearchChange={seatTable.setSearchQuery}
              searchLabel="Search museum-admin seats"
              searchPlaceholder="Search tenant, admin, or email"
              actions={<p className="text-caption">{seatTable.total} seats in current view</p>}
            />
          }
          rowActions={(row) => (
            <div className={styles.rowActions}>
              {row.status === 'suspended' ? (
                <Button tone="secondary" compact onClick={() => setSeatStatus(row.id, 'active')}>
                  Reactivate
                </Button>
              ) : (
                <Button tone="danger" compact onClick={() => setSeatStatus(row.id, 'suspended')}>
                  Suspend
                </Button>
              )}
            </div>
          )}
          stickyHeader
        />
      </Panel>
    </div>
  )
}
