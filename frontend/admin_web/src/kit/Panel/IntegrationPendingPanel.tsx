import type { ReactElement } from 'react'

import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import type { IntegrationPendingPanelProps } from './Panel.types.ts'
import styles from './Panel.module.css'

/** Honest gap shell for a missing integration — dashed border, no amber. */
export function IntegrationPendingPanel({
  dependency,
  body,
  stillUsable,
  action,
  variant = 'region',
}: IntegrationPendingPanelProps): ReactElement {
  const sizeClass = variant === 'inline' ? styles.inline : styles.region

  return (
    <div
      className={`${styles.panel} ${styles.integrationPending} ${sizeClass}`}
      role="status"
    >
      <p className={`${styles.eyebrow} column-header`}>Integration pending</p>
      <div className={styles.header}>
        <span className={styles.marker} aria-hidden="true">
          <StatusMarkerGlyph marker="dash" size={12} />
        </span>
        <h3 className={`${styles.title} text-subtitle`}>{dependency} is not connected yet</h3>
      </div>
      <p className={`${styles.body} text-body`}>{body}</p>
      {stillUsable !== undefined ? (
        <p className={`${styles.footer} text-body`}>{stillUsable}</p>
      ) : null}
      {action !== undefined ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionButton} text-body`}
            onClick={action.onAct}
          >
            {action.label}
          </button>
        </div>
      ) : null}
    </div>
  )
}
