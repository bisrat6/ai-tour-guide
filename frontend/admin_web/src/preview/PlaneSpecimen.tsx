import { useRef, type ReactNode } from 'react'

import { planeLabels, type Plane } from '../tokens/semantic.ts'
import {
  ElevationSpecimen,
  FocusSpecimen,
  RadiusSpecimen,
  SpacingSpecimen,
  StatusMarkers,
  TypeSpecimen,
} from './Specimens.tsx'
import { TokenSwatches } from './TokenSwatches.tsx'
import { useComputedTokens } from './useComputedTokens.ts'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="block">
      <h3 className="block__title">{title}</h3>
      {children}
    </section>
  )
}

type Props = {
  plane: Plane
  /** Surfaces, focus and markers only, for the single-container switch demo. */
  compact?: boolean
}

/** Every Phase 1 token, resolved inside one plane container. */
export function PlaneSpecimen({ plane, compact = false }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const computed = useComputedTokens(container)

  return (
    <div className="specimen" data-plane={plane} ref={container}>
      <header className="specimen__header">
        <p className="column-header">{`data-plane="${plane}"`}</p>
        <h2>{planeLabels[plane]}</h2>
      </header>

      <Block title="Surfaces">
        <div className="surface-stack">
          <div className="surface-stack__rail">
            <p className="column-header">Rail</p>
            <p>Navigation</p>
            <p className="surface-stack__rail-muted text-caption">Seven notices</p>
          </div>
          <div className="surface-stack__main">
            <p className="column-header surface-stack__eyebrow">Canvas</p>
            <div className="surface-stack__card">
              <p className="museum-name">Adwa Victory Memorial</p>
              <p className="text-caption surface-stack__secondary">
                Raised surface, secondary text, and a selected row below.
              </p>
              <p className="surface-stack__selected numeric">04 Legacy and Memory · 3 items</p>
            </div>
            <div className="surface-stack__sunken">Sunken</div>
          </div>
        </div>
      </Block>

      {compact ? null : (
        <>
          <Block title="Semantic tokens">
            <TokenSwatches plane={plane} computed={computed} />
          </Block>

          <Block title="Type scale">
            <TypeSpecimen />
          </Block>

          <Block title="Spacing rhythm">
            <SpacingSpecimen />
          </Block>

          <Block title="Radius">
            <RadiusSpecimen />
          </Block>

          <Block title="Elevation">
            <ElevationSpecimen />
          </Block>
        </>
      )}

      <Block title="Focus ring">
        <FocusSpecimen />
      </Block>

      <Block title="Status markers">
        <StatusMarkers />
      </Block>
    </div>
  )
}
