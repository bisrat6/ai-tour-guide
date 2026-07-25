import type { ReactElement } from 'react'

import { StatusBadge } from '../../kit/StatusBadge/StatusBadge.tsx'
import type { StateFilter } from '../GalleryNav.tsx'
import { SpecimenStack } from './SpecimenStack.tsx'
import styles from '../Gallery.module.css'

const NA_NOTES = [
  {
    state: 'loading' as const,
    reason: 'Does not apply: render Skeleton shape="pill" while status is unknown.',
  },
  {
    state: 'empty' as const,
    reason: 'Does not apply: a badge is a rendered state, not a data region.',
  },
  {
    state: 'failure' as const,
    reason: 'Does not apply: failure belongs to the region that loads status.',
  },
  {
    state: 'unauthorized' as const,
    reason: 'Does not apply: unauthorized belongs to the enclosing region.',
  },
  {
    state: 'integrationPending' as const,
    reason: 'Does not apply: use neutral Unknown or a skeleton instead of guessing.',
  },
] as const

export function StatusBadgeSpecimen({
  stateFilter,
}: {
  readonly stateFilter: StateFilter
}): ReactElement {
  return (
    <SpecimenStack stateFilter={stateFilter} notes={[...NA_NOTES]}>
      {(state) => {
        if (state !== 'ready') return null

        return (
          <div className={styles.badgeRow}>
            <StatusBadge tone="success" label="Ready" />
            <StatusBadge tone="warning" label="Pending" />
            <StatusBadge tone="danger" label="Suspended" detail="Suspended on 12 June by an operator." />
            <StatusBadge tone="neutral" label="Draft" />
            <StatusBadge tone="neutral" label="Unknown" />
          </div>
        )
      }}
    </SpecimenStack>
  )
}
