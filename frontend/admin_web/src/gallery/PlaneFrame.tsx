import type { ReactNode } from 'react'

import type { Plane } from '../tokens/semantic.ts'

import styles from './Gallery.module.css'

export type PlaneFrameProps = {
  readonly plane: Plane
  readonly children: ReactNode
}

/** Sets data-plane; base.css paints the canvas and tokens. */
export function PlaneFrame({ plane, children }: PlaneFrameProps): ReactNode {
  const label = plane === 'tenant' ? 'Tenant plane (light)' : 'Control plane (dark)'

  return (
    <div data-plane={plane} className={styles.planeFrame}>
      <p className={`${styles.planeLabel} column-header`}>{label}</p>
      {children}
    </div>
  )
}
