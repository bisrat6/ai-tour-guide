import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { ReactElement } from 'react'

import { Button, StateBlock, StatusBadge } from '../../kit/index.ts'
import { useFleetStore } from './fleetStore.tsx'
import {
  fleetHealthLabel,
  fleetHealthTone,
  fleetStatusLabel,
  fleetStatusTone,
  fleetUpdatedLabel,
  formatUsd,
} from './fleetFixtures.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import styles from './FleetPage.module.css'

export function TenantRecordPage(): ReactElement {
  const { museumId } = useParams()
  const { museums, status, setFleetScrollY } = useFleetStore()
  const navigate = useNavigate()

  // Redirecting while the fleet is still loading would bounce anyone who
  // arrived on this URL directly, before the museum it names has arrived.
  if (status === 'loading') {
    return <StateBlock state={{ kind: 'loading', label: 'the tenant record' }} size="page" />
  }

  const museum = museums.find((entry) => entry.id === museumId)
  if (museum === undefined) return <Navigate to="/operator/fleet" replace />

  return (
    <div className={styles.recordPage}>
      <header className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div>
            <p className={`museum-name ${styles.museumName}`}>{museum.name}</p>
            <h1 className="text-title">Tenant record</h1>
            <p className={`text-body ${styles.muted}`}>
              {museum.slug} • control-plane record with status, readiness, spend, and operator
              actions.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button tone="secondary" onClick={() => navigate('/operator/fleet')}>
              Back to fleet
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                if (typeof window !== 'undefined') setFleetScrollY(window.scrollY)
                navigate(`/operator/tenant/${museum.id}/overview`)
              }}
            >
              Enter tenant
            </Button>
          </div>
        </div>
      </header>

      <section className={styles.recordGrid}>
        <article className={styles.panel}>
          <p className={`column-header ${styles.muted}`}>Status and readiness</p>
          <StatusBadge tone={fleetStatusTone(museum.status)} label={fleetStatusLabel(museum.status)} />
          <p className="text-body">{museum.roomCount} rooms in configured sequence.</p>
          <p className="text-body">
            Rooms still awaiting narration audio:{' '}
            {museum.readiness.filter((segment) => segment.marker !== 'dot').length}
          </p>
          <p className={`text-caption ${styles.muted}`}>
            Updated {fleetUpdatedLabel(museum.updatedAt)}
          </p>
        </article>

        <article className={styles.panel}>
          <p className={`column-header ${styles.muted}`}>Spend and health</p>
          <p className="text-subtitle numeric">{formatUsd(museum.spendMonthlyUsd)}</p>
          <StatusBadge tone={fleetHealthTone(museum.health)} label={fleetHealthLabel(museum.health)} />
          <DemoDataNote>
            Neither figure is measured. The backend attributes no provider cost to a tenant and
            reports no health signal.
          </DemoDataNote>
        </article>
      </section>

      <section className={styles.panel}>
        <p className={`column-header ${styles.muted}`}>Action intent</p>
        <p className="text-body">
          This route is the Phase 7 tenant record surface. Health, spend attribution timelines, audit history, and
          operator-admin seats remain deferred to Phase 9 routes.
        </p>
      </section>
    </div>
  )
}
