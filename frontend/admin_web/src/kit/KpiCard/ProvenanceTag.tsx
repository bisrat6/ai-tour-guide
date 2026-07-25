import type { ReactElement } from 'react'

import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import type { ProvenanceTagProps } from './KpiCard.types.ts'
import styles from './ProvenanceTag.module.css'

/** Neutral-toned provenance marker. Live data renders no tag. */
export function ProvenanceTag({ provenance, note }: ProvenanceTagProps): ReactElement | null {
  if (provenance === 'live') return null

  const marker = provenance === 'demo' ? 'ring' : 'dash'
  const label = provenance === 'demo' ? 'Demo data' : 'Integration pending'

  return (
    <span className={styles.tag}>
      <StatusMarkerGlyph marker={marker} size={12} />
      <span className={`${styles.label} text-caption`}>
        {label}
        {note !== undefined ? ` · ${note}` : null}
      </span>
    </span>
  )
}
