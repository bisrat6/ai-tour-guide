/**
 * The museum's own administrator accounts.
 *
 * The roster is real. What is not: a person's name, which is derived from the
 * email because the backend stores none, and any notion of suspending or
 * removing an account, for which there is no route at all.
 */

import { useMemo, useState, type FormEvent, type ReactElement } from 'react'

import {
  Button,
  DataTable,
  Field,
  Panel,
  StateBlock,
  StatusBadge,
  TableToolbar,
  TextInput,
  useDataTable,
  useToast,
  type Column,
} from '../../kit/index.ts'
import { useActiveMuseumId } from '../auth/useActiveMuseumId.ts'
import { useAuth } from '../auth/sessionContext.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import { TEAM_MEMBERS } from './teamFixtures.ts'
import {
  displayNameFor,
  formatLastLogin,
  useMuseumAdmins,
  type AdminAccount,
} from './useMuseumAdmins.ts'
import styles from './TeamPage.module.css'

function roleLabel(role: AdminAccount['role']): string {
  return role === 'SYSTEM_ADMIN' ? 'System admin' : 'Museum admin'
}

/**
 * Demo mode has no museum to ask about, so the fixture roster stands in. It is
 * shaped into the same rows so the table below has one source, not two.
 */
const DEMO_ADMINS: readonly AdminAccount[] = TEAM_MEMBERS.map((member, index) => ({
  id: member.id,
  email: member.email,
  role: 'MUSEUM_ADMIN',
  museumId: 'museum-adwa',
  lastLoginAt: new Date(Date.now() - (index + 1) * 3600_000).toISOString(),
  createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
}))

export function TeamPage(): ReactElement {
  const museumId = useActiveMuseumId()
  const { session } = useAuth()
  const { admins, isLive, status, loadError, reload, addAdmin } = useMuseumAdmins(museumId)
  const { show } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adding, setAdding] = useState(false)

  const rows = isLive ? admins : DEMO_ADMINS

  /**
   * Only a system admin may add one. A museum admin sees the roster but not the
   * form, rather than a form that always 403s.
   */
  const canAdd = isLive && session?.role === 'SYSTEM_ADMIN' && museumId !== null

  const columns = useMemo<readonly Column<AdminAccount>[]>(
    () => [
      {
        id: 'name',
        header: 'Administrator',
        sortable: true,
        sortValue: (account) => account.email,
        cell: (account) => (
          <div className={styles.identityCell}>
            <p className="text-body">{displayNameFor(account.email)}</p>
            <p className={`text-caption ${styles.muted}`}>{account.email}</p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        sortable: true,
        sortValue: (account) => account.role,
        cell: (account) => (
          <StatusBadge
            tone={account.role === 'SYSTEM_ADMIN' ? 'warning' : 'success'}
            label={roleLabel(account.role)}
          />
        ),
      },
      {
        id: 'lastLogin',
        header: 'Last signed in',
        sortable: true,
        sortValue: (account) =>
          account.lastLoginAt === null ? 0 : (Date.parse(account.lastLoginAt) || 0),
        cell: (account) => (
          <span className={`text-caption ${styles.muted}`}>
            {formatLastLogin(account.lastLoginAt)}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Added',
        sortable: true,
        sortValue: (account) => Date.parse(account.createdAt) || 0,
        cell: (account) => (
          <span className={`text-caption ${styles.muted}`}>
            {account.createdAt.slice(0, 10)}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useDataTable({
    rows,
    rowKey: (account) => account.id,
    columns,
    pageSize: 8,
    searchFields: [(account) => account.email, (account) => account.role],
    initialSort: { columnId: 'name', direction: 'ascending' },
  })

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setAdding(true)
    const result = await addAdmin({ email, password })
    setAdding(false)

    if (!result.ok) {
      show({ tone: 'danger', message: result.message })
      return
    }

    show({ tone: 'success', message: `${email.trim().toLowerCase()} can now sign in.` })
    setEmail('')
    setPassword('')
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <h1 className="text-title">Team</h1>
          <p className={`text-body ${styles.muted}`}>
            Everyone who can sign in and administer this museum.
          </p>
          <DemoDataNote>
            {isLive
              ? 'Names are derived from each email address. The backend stores no name, and no route exists to suspend or remove an account.'
              : 'No API is configured, so this roster is fixtures.'}
          </DemoDataNote>
        </div>
      </header>

      {status === 'loading' ? (
        <StateBlock state={{ kind: 'loading', label: 'the team' }} />
      ) : null}

      {status === 'error' ? (
        <StateBlock
          state={{
            kind: 'failure',
            title: 'The team did not load',
            body: loadError ?? 'The request failed.',
            retry: { label: 'Try again', onAct: reload },
          }}
        />
      ) : null}

      {status === 'ready' ? (
        <Panel>
          <DataTable
            caption="Museum administrators"
            columns={columns}
            rows={table.pageRows}
            rowKey={(account) => account.id}
            sort={table.sort}
            onSortChange={table.setSort}
            pagination={table.pagination}
            toolbar={
              <TableToolbar
                searchValue={table.searchQuery}
                onSearchChange={table.setSearchQuery}
                searchLabel="Search administrators"
                searchPlaceholder="Search by email or role"
                actions={<p className="text-caption">{table.total} administrators</p>}
              />
            }
            stickyHeader
          />
        </Panel>
      ) : null}

      {canAdd ? (
        <Panel
          title="Add an administrator"
          description="The password cannot be read back afterwards, so pass it on now."
        >
          <form onSubmit={(event) => void submit(event)}>
            <Field id="team-add-email" label="Email" required>
              {(control) => (
                <TextInput
                  {...control}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="admin@museum.example"
                />
              )}
            </Field>
            <Field id="team-add-password" label="Password" required hint="At least 12 characters.">
              {(control) => (
                <TextInput {...control} type="password" value={password} onChange={setPassword} />
              )}
            </Field>
            <Button
              type="submit"
              disabled={adding || email.trim().length === 0 || password.length < 12}
            >
              {adding ? 'Adding…' : 'Add administrator'}
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  )
}
