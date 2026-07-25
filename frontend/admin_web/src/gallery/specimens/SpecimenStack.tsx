import type { ReactElement } from 'react'

import type { StateKind } from '../../kit/types.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import styles from '../Gallery.module.css'

export type StateNoteProps = {
  readonly state: StateKind
  readonly reason: string
}

export function StateNote({ state, reason }: StateNoteProps): ReactElement {
  return (
    <p className={`${styles.stateNote} text-caption`}>
      <strong>{state}:</strong> {reason}
    </p>
  )
}

export type SpecimenStackProps = {
  readonly stateFilter: StateFilter
  readonly children: (state: StateKind | 'ready') => ReactElement | null
  readonly notes?: readonly { readonly state: StateKind; readonly reason: string }[]
}

export function SpecimenStack({
  stateFilter,
  children,
  notes = [],
}: SpecimenStackProps): ReactElement {
  const states: readonly (StateKind | 'ready')[] =
    stateFilter === 'all'
      ? ['ready', 'loading', 'empty', 'failure', 'unauthorized', 'integrationPending']
      : [stateFilter]

  return (
    <div className={styles.stateStack}>
      {states.map((state) => {
        const note = notes.find((entry) => entry.state === state)
        if (note !== undefined) {
          return <StateNote key={state} state={note.state} reason={note.reason} />
        }
        const content = children(state)
        return content !== null ? (
          <div key={state} className={styles.stateBlock} data-state={state}>
            {stateFilter === 'all' ? (
              <p className={`${styles.stateHeading} column-header`}>{state}</p>
            ) : null}
            {content}
          </div>
        ) : null
      })}
    </div>
  )
}

function PlusIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export { PlusIcon }
