import { useMemo, type ReactElement } from 'react'

import { DataTable, Panel, StatusBadge, TableToolbar, useDataTable, type Column } from '../../kit/index.ts'
import { TEAM_MEMBERS, type TeamMember } from './teamFixtures.ts'
import styles from './TeamPage.module.css'

function roleLabel(role: TeamMember['role']): string {
  if (role === 'MUSEUM_ADMIN') return 'Museum admin'
  if (role === 'CURATOR') return 'Curator'
  return 'Editor'
}

export function TeamPage(): ReactElement {
  const columns = useMemo<readonly Column<TeamMember>[]>(
    () => [
      {
        id: 'name',
        header: 'Staff',
        sortable: true,
        sortValue: (member) => member.name,
        cell: (member) => (
          <div className={styles.identityCell}>
            <p className="text-body">{member.name}</p>
            <p className={`text-caption ${styles.muted}`}>{member.email}</p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        sortable: true,
        sortValue: (member) => member.role,
        cell: (member) => (
          <StatusBadge
            tone={member.role === 'MUSEUM_ADMIN' ? 'success' : 'neutral'}
            label={roleLabel(member.role)}
          />
        ),
      },
      {
        id: 'access',
        header: 'Access',
        sortable: true,
        sortValue: (member) => member.accessSummary,
        cell: (member) => <span className="text-body">{member.accessSummary}</span>,
      },
      {
        id: 'lastActive',
        header: 'Last active',
        sortable: true,
        sortValue: (member) => member.lastActive,
        cell: (member) => <span className={`text-caption ${styles.muted}`}>{member.lastActive}</span>,
      },
    ],
    [],
  )

  const table = useDataTable({
    rows: TEAM_MEMBERS,
    rowKey: (member) => member.id,
    columns,
    pageSize: 8,
    searchFields: [(member) => member.name, (member) => member.email, (member) => member.role],
    initialSort: { columnId: 'name', direction: 'ascending' },
  })

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Team</h1>
          <p className={`text-body ${styles.muted}`}>
            Tenant-scoped staff roster and access visibility for this museum only.
          </p>
        </div>
      </header>

      <Panel>
        <DataTable
          caption="Museum team"
          columns={columns}
          rows={table.pageRows}
          rowKey={(member) => member.id}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={table.pagination}
          toolbar={
            <TableToolbar
              searchValue={table.searchQuery}
              onSearchChange={table.setSearchQuery}
              searchLabel="Search team members"
              searchPlaceholder="Search by name, email, or role"
              actions={<p className="text-caption">{table.total} staff members</p>}
            />
          }
          stickyHeader
        />
      </Panel>
    </div>
  )
}
