import type { ReactElement } from 'react'

import styles from './State.module.css'

import { Skeleton } from './Skeleton.tsx'
import { StatusMarkerGlyph } from './StatusMarkerGlyph.tsx'
import type { StateBlockProps } from './State.types.ts'
import type { KitState } from '../types.ts'

const DEFAULT_FAILURE: Extract<KitState, { kind: 'failure' }> = {
  kind: 'failure',
  title: 'Something did not load',
  body: 'The request failed. Try again, or reload the page.',
  retry: { label: 'Try again', onAct: () => undefined },
}

const DEFAULT_UNAUTHORIZED: Extract<KitState, { kind: 'unauthorized' }> = {
  kind: 'unauthorized',
  title: 'You do not have access to this',
  body: 'Your role does not include this data. Ask a system administrator if you need it.',
}

function sizeClass(size: NonNullable<StateBlockProps['size']>): string {
  if (size === 'inline') return styles.inline
  if (size === 'page') return styles.page
  return styles.region
}

function StateActionButton({
  label,
  onAct,
}: {
  readonly label: string
  readonly onAct: () => void
}): ReactElement {
  return (
    <div className={styles.actions}>
      <button type="button" className={`${styles.actionButton} text-body`} onClick={onAct}>
        {label}
      </button>
    </div>
  )
}

/** Renders non-ready KitState variants with defaults and accessible announcements. */
export function StateBlock({
  state,
  size = 'region',
  skeleton,
  announce = true,
  id,
}: StateBlockProps): ReactElement | null {
  if (state.kind === 'ready') return null

  const rootClass = `${styles.root} ${sizeClass(size)}`

  if (state.kind === 'loading') {
    const label = state.label ?? 'content'
    return (
      <div
        id={id}
        className={`${rootClass} ${styles.loading}`}
        role={announce ? 'status' : undefined}
        aria-live={announce ? 'polite' : undefined}
        aria-busy="true"
        aria-label={`Loading ${label}`}
      >
        {skeleton ?? <Skeleton region={label} shape="block" />}
      </div>
    )
  }

  if (state.kind === 'empty') {
    return (
      <div
        id={id}
        className={rootClass}
        role={announce ? 'status' : undefined}
        aria-live={announce ? 'polite' : undefined}
      >
        <div className={styles.header}>
          <span className={`${styles.marker} ${styles.markerAccent}`} aria-hidden="true">
            <StatusMarkerGlyph marker="dot" size={12} />
          </span>
          <h3 className={`${styles.title} text-subtitle`}>{state.title}</h3>
        </div>
        {state.body !== undefined ? <p className={`${styles.body} text-body`}>{state.body}</p> : null}
        {state.action !== undefined ? (
          <StateActionButton label={state.action.label} onAct={state.action.onAct} />
        ) : null}
      </div>
    )
  }

  if (state.kind === 'failure') {
    const failure = {
      ...DEFAULT_FAILURE,
      ...state,
      retry: state.retry ?? DEFAULT_FAILURE.retry,
    }

    return (
      <div id={id} className={rootClass} role="alert">
        <div className={styles.header}>
          <span className={`${styles.marker} ${styles.markerFailure}`} aria-hidden="true">
            <StatusMarkerGlyph marker="cross" size={12} />
          </span>
          <h3 className={`${styles.title} text-subtitle`}>{failure.title}</h3>
        </div>
        <p className={`${styles.body} text-body`}>{failure.body}</p>
        {failure.retry !== undefined ? (
          <StateActionButton label={failure.retry.label} onAct={failure.retry.onAct} />
        ) : null}
      </div>
    )
  }

  if (state.kind === 'unauthorized') {
    const unauthorized = { ...DEFAULT_UNAUTHORIZED, ...state }

    return (
      <div
        id={id}
        className={rootClass}
        role={announce ? 'status' : undefined}
        aria-live={announce ? 'polite' : undefined}
      >
        <div className={styles.header}>
          <span className={`${styles.marker} ${styles.markerMuted}`} aria-hidden="true">
            <StatusMarkerGlyph marker="dash" size={12} />
          </span>
          <h3 className={`${styles.title} text-subtitle`}>{unauthorized.title}</h3>
        </div>
        <p className={`${styles.body} text-body`}>{unauthorized.body}</p>
      </div>
    )
  }

  return (
    <div
      id={id}
      className={rootClass}
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
    >
      <p className={`${styles.eyebrow} column-header`}>Integration pending</p>
      <div className={styles.header}>
        <span className={`${styles.marker} ${styles.markerNeutral}`} aria-hidden="true">
          <StatusMarkerGlyph marker="dash" size={12} />
        </span>
        <h3 className={`${styles.title} text-subtitle`}>{state.dependency} is not connected yet</h3>
      </div>
      <p className={`${styles.body} text-body`}>{state.body}</p>
      {state.stillUsable !== undefined ? (
        <p className={`${styles.footer} text-body`}>{state.stillUsable}</p>
      ) : null}
    </div>
  )
}
