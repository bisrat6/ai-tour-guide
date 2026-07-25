import type { ReactElement } from 'react'

import { KpiCard } from '../../kit/KpiCard/KpiCard.tsx'
import type { KpiCardProps } from '../../kit/KpiCard/KpiCard.types.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import { kpiFixtures, kpiStateSpecimens } from '../fixtures/kpis.ts'
import styles from '../Gallery.module.css'

function matchesFilter(state: KpiCardProps['state'], filter: StateFilter): boolean {
  if (filter === 'all') return true
  const kind = state?.kind ?? 'ready'
  return kind === filter
}

type KpiCardSpecimenProps = {
  readonly stateFilter: StateFilter
}

/** KPI card gallery specimen — ready fixtures and all five states. */
export function KpiCardSpecimen({ stateFilter }: KpiCardSpecimenProps): ReactElement {
  const showReady = stateFilter === 'all' || stateFilter === 'ready'
  const stateRows = kpiStateSpecimens.filter((entry) => matchesFilter(entry.state, stateFilter))

  return (
    <div className={styles.specimenStack}>
      {showReady ? (
        <div className={styles.specimenGrid}>
          {kpiFixtures.map((fixture) => (
            <KpiCard key={fixture.label} {...fixture} />
          ))}
        </div>
      ) : null}
      {stateRows.length > 0 ? (
        <div className={styles.specimenGrid}>
          {stateRows.map((fixture) => (
            <KpiCard key={`${fixture.label}-${fixture.state?.kind}`} {...fixture} />
          ))}
        </div>
      ) : null}
      {stateFilter !== 'all' && stateFilter !== 'ready' && stateRows.length === 0 ? (
        <p className="text-caption">No KPI specimen for state: {stateFilter}.</p>
      ) : null}
    </div>
  )
}
