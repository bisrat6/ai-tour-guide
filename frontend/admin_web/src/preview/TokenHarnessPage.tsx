import { useState } from 'react'

import { ContrastTable } from './ContrastTable.tsx'
import { PlaneSpecimen } from './PlaneSpecimen.tsx'
import { planeLabels, type Plane } from '../tokens/semantic.ts'
import '../styles/preview.css'

/**
 * Phase 1 review harness. This is not the app shell: there are no components,
 * no routing and no screens here. It exists so a reviewer can resolve every
 * token in both planes and read a measured contrast result for each pair.
 */
export function TokenHarnessPage() {
  const [plane, setPlane] = useState<Plane>('tenant')
  const other: Plane = plane === 'tenant' ? 'control' : 'tenant'

  return (
    <div className="harness">
      <header className="harness__header">
        <p className="column-header">Adwa admin web · Phase 1</p>
        <h1>Token layer and plane theming</h1>
        <p className="harness__lede text-body-large">
          A review harness for the token layer. Every semantic token resolves to a named step in the
          zinc, emerald or status scales, and every text and boundary pair is measured in both
          planes. It is not an app shell, and it ships no components.
        </p>
      </header>

      <main className="harness__main">
        <section className="harness__section" aria-labelledby="side-by-side">
          <div className="harness__section-header">
            <h2 id="side-by-side">Both planes, side by side</h2>
            <p className="text-caption">
              The tenant plane is the lit gallery; the control plane is the instrument room behind
              it. Each column is a container carrying its own <code>data-plane</code> attribute.
            </p>
          </div>
          <div className="plane-grid">
            <PlaneSpecimen plane="tenant" />
            <PlaneSpecimen plane="control" />
          </div>
        </section>

        <section className="harness__section" aria-labelledby="switch">
          <div className="harness__section-header">
            <h2 id="switch">One container, switched</h2>
            <p className="text-caption">
              The same markup, flipped by changing one attribute on the container. Nothing inside it
              knows which plane it is in.
            </p>
            <button type="button" className="demo-button" onClick={() => setPlane(other)}>
              Switch this container to the {other} plane
            </button>
            <p className="text-caption" role="status">
              Showing {planeLabels[plane].toLowerCase()}.
            </p>
          </div>
          <PlaneSpecimen plane={plane} compact />
        </section>

        <section className="harness__section" aria-labelledby="contrast">
          <div className="harness__section-header">
            <h2 id="contrast">Contrast audit</h2>
            <p className="text-caption">
              Measured with the WCAG 2.1 relative-luminance formula from the token values
              themselves. Translucent tints are flattened onto the surface they sit on first. The
              same numbers are written to <code>docs/contrast-audit.md</code> by{' '}
              <code>npm run audit:contrast</code>.
            </p>
          </div>
          <ContrastTable />
        </section>
      </main>
    </div>
  )
}
