import type { ReactElement } from 'react'

import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import { TONE_MARKER, type StatusBadgeProps } from './StatusBadge.types.ts'
import styles from './StatusBadge.module.css'

function toneClass(tone: StatusBadgeProps['tone']): string {
  if (tone === 'warning') return styles.warning
  if (tone === 'danger') return styles.danger
  if (tone === 'neutral') return styles.neutral
  return styles.success
}

export function StatusBadge({
  tone,
  label,
  marker,
  detail,
  id,
}: StatusBadgeProps): ReactElement {
  const resolvedMarker = marker ?? TONE_MARKER[tone]

  return (
    <span id={id} className={`${styles.root} ${toneClass(tone)}`}>
      <StatusMarkerGlyph marker={resolvedMarker} size={12} />
      <span className={`${styles.label} text-caption`}>{label}</span>
      {detail !== undefined ? <VisuallyHidden>. {detail}</VisuallyHidden> : null}
    </span>
  )
}

export { TONE_MARKER } from './StatusBadge.types.ts'
