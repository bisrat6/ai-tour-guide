/**
 * Administrator accounts across the whole fleet.
 *
 * The museum-admin table is real: one `GET /admin/museums/:id/admins` per
 * museum, and creation goes to the matching POST. The operator-account table
 * above it is not — there is no route that lists system admins, and none that
 * suspends any account of either kind, so both stay fixtures and say so.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'

import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import {
  Button,
  DataTable,
  Field,
  Panel,
  Select,
  StateBlock,
  StatusBadge,
  TableToolbar,
  TextInput,
  useDataTable,
  useToast,
  type Column,
} from '../../kit/index.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import {
  displayNameFor,
  fetchMuseumAdmins,
  formatLastLogin,
  type AdminAccount,
} from '../team/useMuseumAdmins.ts'
import * as api from '../../api/adminApi.ts'
import { useFleetStore } from './fleetStore.tsx'
import {
  MUSEUM_ADMIN_SEAT_FIXTURES,
  OPERATOR_ADMIN_FIXTURES,
  adminStatusLabel,
  adminStatusTone,
  type OperatorAdminAccount,
} from './phase9Fixtures.ts'
import styles from './OperatorPhase9Pages.module.css'

/** An account plus the museum it belongs to, which the row itself only names by id. */
type SeatRow = AdminAccount & { readonly museumName: string }

type SeatDraft = {
  readonly museumId: string
  readonly email: string
  readonly password: string
}

const EMPTY_SEAT_DRAFT: SeatDraft = { museumId: '', email: '', password: '' }

const DEMO_SEATS: readonly SeatRow[] = MUSEUM_ADMIN_SEAT_FIXTURES.map((seat, index) => ({
  id: seat.id,
  email: seat.email,
  role: 'MUSEUM_ADMIN',
  museumId: seat.tenantId,
  museumName: seat.tenantName,
  lastLoginAt: new Date(Date.now() - (index + 1) * 7200_000).toISOString(),
  createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
}))

export function AdminsPage(): ReactElement {
  const { museums, status: fleetStatus } = useFleetStore()
  const { show } = useToast()

  const [operators] = useState<readonly OperatorAdminAccount[]>(OPERATOR_ADMIN_FIXTURES)
  const [seats, setSeats] = useState<readonly SeatRow[]>([])
  const [seatStatus, setSeatStatus] = useState<'loading' | 'ready' | 'error'>(
    isLiveApi ? 'loading' : 'ready',
  )
  const [seatError, setSeatError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [seatDraft, setSeatDraft] = useState<SeatDraft>(EMPTY_SEAT_DRAFT)
  const [creating, setCreating] = useState(false)
  const [museumFilter, setMuseumFilter] = useState<string>('all')

  useEffect(() => {
    if (!isLiveApi) return
    // Nothing to fan out over until the fleet itself has arrived.
    if (fleetStatus !== 'ready') return

    let current = true
    setSeatStatus('loading')
    setSeatError(null)

    Promise.all(
      museums.map(async (museum) =>
        (await fetchMuseumAdmins(museum.id)).map((account) => ({
          ...account,
          museumName: museum.name,
        })),
      ),
    )
      .then((perMuseum) => {
        if (!current) return
        setSeats(perMuseum.flat())
        setSeatStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setSeats([])
        setSeatStatus('error')
        setSeatError(isApiError(error) ? error.message : 'Could not load administrator accounts.')
      })

    return () => {
      current = false
    }
  }, [fleetStatus, museums, reloadToken])

  const rows = isLiveApi ? seats : DEMO_SEATS

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
        cell: (row) => (
          <StatusBadge tone={adminStatusTone(row.status)} label={adminStatusLabel(row.status)} />
        ),
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

  const seatColumns = useMemo<readonly Column<SeatRow>[]>(
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
        id: 'admin',
        header: 'Museum admin',
        sortable: true,
        sortValue: (row) => row.email,
        cell: (row) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{displayNameFor(row.email)}</span>
            <span className={`text-caption ${styles.muted}`}>{row.email}</span>
          </div>
        ),
      },
      {
        id: 'lastLogin',
        header: 'Last signed in',
        sortable: true,
        sortValue: (row) => (row.lastLoginAt === null ? 0 : (Date.parse(row.lastLoginAt) || 0)),
        cell: (row) => (
          <span className={`text-caption ${styles.muted}`}>{formatLastLogin(row.lastLoginAt)}</span>
        ),
      },
      {
        id: 'created',
        header: 'Added',
        sortable: true,
        sortValue: (row) => Date.parse(row.createdAt) || 0,
        cell: (row) => (
          <span className={`text-caption ${styles.monoDate}`}>{row.createdAt.slice(0, 10)}</span>
        ),
      },
    ],
    [],
  )

  const filteredSeats = useMemo(
    () => (museumFilter === 'all' ? rows : rows.filter((row) => row.museumId === museumFilter)),
    [museumFilter, rows],
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
    searchFields: [(row) => row.museumName, (row) => row.email],
    initialSort: { columnId: 'tenant', direction: 'ascending' },
  })

  const museumOptions = useMemo(
    () => museums.map((museum) => ({ value: museum.id, label: museum.name })),
    [museums],
  )

  async function addSeat(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setCreating(true)
    try {
      await api.addMuseumAdmin(seatDraft.museumId, {
        email: seatDraft.email.trim().toLowerCase(),
        password: seatDraft.password,
      })
      setSeatDraft(EMPTY_SEAT_DRAFT)
      setReloadToken((token) => token + 1)
      show({ tone: 'success', message: 'The administrator can now sign in.' })
    } catch (error) {
      show({
        tone: 'danger',
        message: isApiError(error) ? error.message : 'Could not add that administrator.',
      })
    } finally {
      setCreating(false)
    }
  }

  const canCreate =
    isLiveApi &&
    seatDraft.museumId.length > 0 &&
    seatDraft.email.trim().length > 0 &&
    seatDraft.password.length >= 12

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <h1 className="text-title">Admins</h1>
        <p className={`text-body ${styles.muted}`}>
          Every account that can sign in, across the fleet.
        </p>
      </header>

      <Panel title="Operator accounts">
        <DemoDataNote>
          Illustrative. There is no route that lists system administrators, and none that suspends
          or reactivates any account.
        </DemoDataNote>
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
          stickyHeader
        />
      </Panel>

      {isLiveApi ? (
        <form className={styles.formCard} onSubmit={(event) => void addSeat(event)}>
          <p className="text-subtitle">Add a museum administrator</p>
          <div className={styles.formGrid}>
            <Field id="seat-create-museum" label="Museum" required>
              {(control) => (
                <Select
                  {...control}
                  value={seatDraft.museumId}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, museumId: value }))}
                  options={[{ value: '', label: 'Select a museum' }, ...museumOptions]}
                />
              )}
            </Field>
            <Field id="seat-create-email" label="Email" required>
              {(control) => (
                <TextInput
                  {...control}
                  type="email"
                  value={seatDraft.email}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, email: value }))}
                  placeholder="admin@museum.example"
                />
              )}
            </Field>
            <Field
              id="seat-create-password"
              label="Password"
              required
              hint="At least 12 characters. It cannot be read back."
            >
              {(control) => (
                <TextInput
                  {...control}
                  type="password"
                  value={seatDraft.password}
                  onChange={(value) => setSeatDraft((current) => ({ ...current, password: value }))}
                />
              )}
            </Field>
            <div className={styles.statusRow}>
              <Button type="submit" disabled={!canCreate || creating}>
                {creating ? 'Adding…' : 'Add administrator'}
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      <Panel
        title="Museum administrators"
        description="Who can sign in for each tenant. Names are derived from email addresses."
      >
        <div className={styles.filtersRow}>
          <Field id="seat-museum-filter" label="Museum filter">
            {(control) => (
              <Select
                {...control}
                value={museumFilter}
                onChange={setMuseumFilter}
                options={[{ value: 'all', label: 'All museums' }, ...museumOptions]}
              />
            )}
          </Field>
        </div>

        {seatStatus === 'loading' ? (
          <StateBlock state={{ kind: 'loading', label: 'administrator accounts' }} />
        ) : null}

        {seatStatus === 'error' ? (
          <StateBlock
            state={{
              kind: 'failure',
              title: 'Administrator accounts did not load',
              body: seatError ?? 'The request failed.',
              retry: { label: 'Try again', onAct: () => setReloadToken((token) => token + 1) },
            }}
          />
        ) : null}

        {seatStatus === 'ready' ? (
          <DataTable
            caption="Museum administrators"
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
                searchLabel="Search museum administrators"
                searchPlaceholder="Search tenant or email"
                actions={<p className="text-caption">{seatTable.total} accounts in current view</p>}
              />
            }
            stickyHeader
          />
        ) : null}
      </Panel>
    </div>
  )
}
