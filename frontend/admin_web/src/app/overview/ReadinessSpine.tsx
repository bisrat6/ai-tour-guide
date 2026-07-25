import type { ReactElement } from 'react'

import { StatusMarkerGlyph } from '../../kit/index.ts'
import type { RoomReadiness } from './overviewFixtures.ts'
import styles from './TenantOverviewPage.module.css'

type ReadinessSpineProps = {
  readonly rooms: readonly RoomReadiness[]
}

function markerToneClass(marker: RoomReadiness['marker']): string {
  if (marker === 'dot') return styles.markerSuccess
  if (marker === 'ring') return styles.markerWarning
  if (marker === 'cross') return styles.markerDanger
  return styles.markerNeutral
}

export function ReadinessSpine({ rooms }: ReadinessSpineProps): ReactElement {
  return (
    <nav className={styles.spineWrap} aria-label="Room readiness spine">
      <ol className={styles.spineList}>
        {rooms.map((room) => (
          <li key={room.id} className={styles.spineItem}>
            <a
              href={`#room-${room.id}`}
              className={styles.spineSegment}
              aria-label={`Room ${room.order}. ${room.title}. Narration ${room.narrationLabel}. Jump to room details.`}
            >
              <span className={`${styles.segmentOrder} text-caption numeric`}>{room.order}</span>
              <span className={markerToneClass(room.marker)}>
                <StatusMarkerGlyph marker={room.marker} size={12} />
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
