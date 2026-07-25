import type { ReactElement } from 'react'

import type { StatusMarker } from '../types.ts'
import type { StatusMarkerGlyphProps } from './State.types.ts'

function DotGlyph(): ReactElement {
  return <circle cx="6" cy="6" r="4" fill="currentColor" />
}

function RingGlyph(): ReactElement {
  return (
    <circle
      cx="6"
      cy="6"
      r="3.25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  )
}

function CrossGlyph(): ReactElement {
  return (
    <>
      <line
        x1="3"
        y1="3"
        x2="9"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="3"
        x2="3"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  )
}

function DashGlyph(): ReactElement {
  return (
    <line
      x1="2.5"
      y1="6"
      x2="9.5"
      y2="6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  )
}

const GLYPHS: Readonly<Record<StatusMarker, () => ReactElement>> = {
  dot: DotGlyph,
  ring: RingGlyph,
  cross: CrossGlyph,
  dash: DashGlyph,
}

/** Four marker shapes on a shared 12×12 grid. Geometry only — colour via currentColor. */
export function StatusMarkerGlyph({ marker, size = 12 }: StatusMarkerGlyphProps): ReactElement {
  const Glyph = GLYPHS[marker]

  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <Glyph />
    </svg>
  )
}
