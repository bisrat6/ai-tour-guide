/**
 * Says out loud that what is on screen is not coming from the server.
 *
 * The kit already has the vocabulary for this — `Provenance` is
 * `live | demo | pending` and `ProvenanceTag` renders the marker — so this only
 * adds the sentence explaining which part of the page is affected and why.
 *
 * Use `demo` for figures with no endpoint behind them, and `pending` for a
 * control whose backing route exists but is not wired to a UI yet.
 */

import type { ReactElement } from 'react'

import { ProvenanceTag, type Provenance } from '../../kit/index.ts'
import styles from './DemoDataNote.module.css'

export function DemoDataNote({
  provenance = 'demo',
  children,
}: {
  readonly provenance?: Provenance
  readonly children: string
}): ReactElement | null {
  if (provenance === 'live') return null

  return (
    <p className={styles.note}>
      <ProvenanceTag provenance={provenance} />
      <span className="text-caption">{children}</span>
    </p>
  )
}

/** The sentence used wherever a whole page is fixtures. */
export const NO_ENDPOINT_YET =
  'These figures are illustrative. The backend has no endpoint for them yet, so nothing here reflects real activity.'
