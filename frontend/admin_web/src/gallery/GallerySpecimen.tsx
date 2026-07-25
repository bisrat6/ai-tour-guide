import type { ReactElement, ReactNode } from 'react'

import type { Plane } from '../tokens/semantic.ts'

import { PlaneFrame } from './PlaneFrame.tsx'
import type { StateFilter } from './GalleryNav.tsx'
import styles from './Gallery.module.css'

export type GallerySpecimenProps = {
  readonly id: string
  readonly name: string
  readonly contract: string
  readonly planeMode: 'both' | Plane
  readonly stateFilter: StateFilter
  readonly hidePendingNote?: boolean
  readonly children?: ReactNode
  readonly renderContent?: (plane: Plane) => ReactNode
}

/** One component section: contract line, plane frames, future state grid. */
export function GallerySpecimen({
  id,
  name,
  contract,
  planeMode,
  stateFilter,
  hidePendingNote = false,
  children,
  renderContent,
}: GallerySpecimenProps): ReactElement {
  const showTenant = planeMode === 'both' || planeMode === 'tenant'
  const showControl = planeMode === 'both' || planeMode === 'control'

  return (
    <section id={id} className={styles.specimen} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-subtitle">
        {name}
      </h2>
      <p className={`${styles.contract} text-body`}>{contract}</p>
      {hidePendingNote ? null : (
        <p className={`${styles.pendingNote} text-caption`}>
          Specimen renders in W1–W4. State filter: {stateFilter}.
        </p>
      )}
      <div className={styles.planeGrid}>
        {showTenant ? (
          <PlaneFrame plane="tenant">
            <div className={styles.specimenSlot}>
              {renderContent ? renderContent('tenant') : children}
            </div>
          </PlaneFrame>
        ) : null}
        {showControl ? (
          <PlaneFrame plane="control">
            <div className={styles.specimenSlot}>
              {renderContent ? renderContent('control') : children}
            </div>
          </PlaneFrame>
        ) : null}
      </div>
    </section>
  )
}
