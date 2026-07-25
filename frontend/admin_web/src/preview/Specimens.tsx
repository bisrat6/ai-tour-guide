import type { CSSProperties, ReactNode } from 'react'

import { toCssVar } from '../tokens/primitives.ts'
import { radiusTokens, spacingTokens, typeSteps } from '../tokens/scales.ts'

/** The type scale, rendered from the same tokens the stylesheet ships. */
export function TypeSpecimen() {
  return (
    <ul className="specimen-list">
      {typeSteps.map((step) => {
        const style: CSSProperties = {
          fontSize: `var(${toCssVar(`${step.name}.size`)})`,
          lineHeight: `var(${toCssVar(`${step.name}.line`)})`,
          fontWeight: `var(${toCssVar(`${step.name}.weight`)})`,
          letterSpacing: `var(${toCssVar(`${step.name}.tracking`)})`,
          ...(step.transform === undefined ? {} : { textTransform: step.transform }),
        }
        return (
          <li key={step.name} className="type-row">
            <span style={style}>Adwa Victory Memorial</span>
            <span className="specimen-meta text-caption">
              <code>{step.name}</code>
              <span className="numeric">
                {step.size} / {step.lineHeight} / {step.weight}
              </span>
              <span>{step.use}</span>
            </span>
          </li>
        )
      })}
      <li className="type-row">
        <span className="museum-name">Adwa Victory Memorial</span>
        <span className="specimen-meta text-caption">
          <code>.museum-name</code>
          <span>Cormorant Garamond 600, the one place a museum name is set</span>
        </span>
      </li>
      <li className="type-row">
        <span className="numeric text-body-large">1,284 visits · $1,240.00 · 14 of 18 rooms</span>
        <span className="specimen-meta text-caption">
          <code>.numeric</code>
          <span>tabular numerals for every figure and numeric column</span>
        </span>
      </li>
    </ul>
  )
}

/** The 8px rhythm. */
export function SpacingSpecimen() {
  return (
    <ul className="specimen-list">
      {spacingTokens.map((token) => (
        <li key={token.name} className="rhythm-row">
          <span className="rhythm-bar" style={{ inlineSize: `var(${token.cssVar})` }} aria-hidden="true" />
          <span className="specimen-meta text-caption">
            <code>{token.name}</code>
            <span className="numeric">{token.value}</span>
          </span>
        </li>
      ))}
      <li className="rhythm-row">
        <span className="rhythm-target" aria-hidden="true" />
        <span className="specimen-meta text-caption">
          <code>target.min</code>
          <span className="numeric">44px</span>
          <span>the minimum interactive target</span>
        </span>
      </li>
    </ul>
  )
}

/** Radius steps, on the surfaces each one belongs to. */
export function RadiusSpecimen() {
  return (
    <ul className="specimen-grid">
      {radiusTokens.map((token) => (
        <li key={token.name} className="radius-item">
          <span className="radius-box" style={{ borderRadius: `var(${token.cssVar})` }} aria-hidden="true" />
          <span className="specimen-meta text-caption">
            <code>{token.name}</code>
            <span className="numeric">{token.value}</span>
            <span>{token.note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Hairline plus a very soft shadow, and the scrim used instead of a deeper one. */
export function ElevationSpecimen() {
  return (
    <ul className="specimen-grid">
      <li className="elevation-item">
        <span className="elevation-box" aria-hidden="true" />
        <span className="specimen-meta text-caption">
          <code>elevation.flat</code>
          <span>a hairline border alone</span>
        </span>
      </li>
      <li className="elevation-item">
        <span className="elevation-box elevation-box--soft" aria-hidden="true" />
        <span className="specimen-meta text-caption">
          <code>elevation.soft</code>
          <span>hairline plus a very soft shadow, for panels and overlays</span>
        </span>
      </li>
      <li className="elevation-item">
        <span className="elevation-scrim" aria-hidden="true">
          <span className="elevation-box elevation-box--soft" />
        </span>
        <span className="specimen-meta text-caption">
          <code>surface.scrim</code>
          <span>separation for an overlay, instead of a deeper shadow</span>
        </span>
      </li>
    </ul>
  )
}

/** Focus is a real interaction, so these are real controls. */
export function FocusSpecimen() {
  return (
    <div className="focus-row">
      <button type="button" className="demo-button">
        Primary action
      </button>
      <button type="button" className="demo-button demo-button--secondary">
        Secondary action
      </button>
      <label className="demo-field">
        <span className="column-header">Search</span>
        <input type="text" placeholder="Museum name" />
      </label>
      <p className="specimen-meta text-caption">
        Tab through these to see the 2px ring at a 2px offset. The same ring is used on both planes.
      </p>
    </div>
  )
}

type Marker = {
  id: string
  state: string
  shape: string
  colorVar: string
  draw: ReactNode
}

const markers: Marker[] = [
  {
    id: 'active',
    state: 'Active or ready',
    shape: 'Filled dot',
    colorVar: '--feedback-success',
    draw: <circle cx="8" cy="8" r="4" fill="currentColor" />,
  },
  {
    id: 'pending',
    state: 'Pending or generating',
    shape: 'Hollow ring',
    colorVar: '--feedback-warning',
    draw: <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />,
  },
  {
    id: 'suspended',
    state: 'Suspended or failed',
    shape: 'Cross',
    colorVar: '--feedback-danger',
    draw: (
      <path
        d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: 'draft',
    state: 'Draft or not started',
    shape: 'Dash',
    colorVar: '--feedback-neutral',
    draw: <path d="M4 8 L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  },
]

/**
 * The four marker shapes. Hue is the fast read; the shape and the label are
 * what carry the state when hue fails. These are flat demos, not components:
 * the status badge is Phase 2.
 */
export function StatusMarkers() {
  return (
    <ul className="specimen-list">
      {markers.map((marker) => (
        <li key={marker.id} className="marker-row">
          <svg
            className="marker"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            style={{ color: `var(${marker.colorVar})` }}
          >
            {marker.draw}
          </svg>
          <span className="marker-label">{marker.state}</span>
          <span className="specimen-meta text-caption">{marker.shape}</span>
        </li>
      ))}
    </ul>
  )
}
