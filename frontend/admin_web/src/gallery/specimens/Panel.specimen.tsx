import type { ReactElement } from 'react'

import { IntegrationPendingPanel } from '../../kit/Panel/IntegrationPendingPanel.tsx'
import { Panel } from '../../kit/Panel/Panel.tsx'
import type { StateFilter } from '../GalleryNav.tsx'
import styles from '../Gallery.module.css'

type PanelSpecimenProps = {
  readonly stateFilter: StateFilter
}

/** Panel and integration-pending panel gallery specimen. */
export function PanelSpecimen({ stateFilter }: PanelSpecimenProps): ReactElement {
  if (stateFilter !== 'all' && stateFilter !== 'ready' && stateFilter !== 'integrationPending') {
    return (
      <p className="text-caption">
        Unauthorized, loading, empty and failure do not apply: IntegrationPendingPanel is itself
        the integration-pending state treatment.
      </p>
    )
  }

  return (
    <div className={styles.specimenStack}>
      <Panel title="Panel container" description="Plain raised panel for grouped content.">
        <p className="text-body">Panel body content sits here.</p>
      </Panel>

      <IntegrationPendingPanel
        dependency="the visit reporting API"
        body="Visit counts and trend charts need the reporting adapter before they can show real numbers."
        stillUsable="Room readiness and narration status still update from the CMS."
        variant="region"
      />

      <IntegrationPendingPanel
        dependency="the spend tracker"
        body="Spend figures stay blank until billing data is connected."
        variant="inline"
      />
    </div>
  )
}
