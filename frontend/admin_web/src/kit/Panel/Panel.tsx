import type { ReactElement } from 'react'

import type { PanelProps } from './Panel.types.ts'
import styles from './Panel.module.css'

/** Plain raised panel container. */
export function Panel({
  title,
  description,
  actions,
  padded = true,
  children,
}: PanelProps): ReactElement {
  return (
    <div className={padded ? `${styles.panel} ${styles.padded}` : styles.panel}>
      {title !== undefined ? <h3 className={`${styles.title} text-subtitle`}>{title}</h3> : null}
      {description !== undefined ? (
        <p className={`${styles.description} text-body`}>{description}</p>
      ) : null}
      {children}
      {actions !== undefined ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
}
