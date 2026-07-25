import type { ReactElement } from 'react'
import { useId } from 'react'

import { Skeleton } from '../State/Skeleton.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import { resolveState, type KitState } from '../types.ts'
import type { KpiCardProps } from './KpiCard.types.ts'
import styles from './KpiCard.module.css'
import { ProvenanceTag } from './ProvenanceTag.tsx'

function deltaToneClass(tone: NonNullable<KpiCardProps['delta']>['tone']): string {
  if (tone === 'success') return styles.deltaSuccess
  if (tone === 'danger') return styles.deltaDanger
  return styles.deltaNeutral
}

function deltaArrow(direction: NonNullable<KpiCardProps['delta']>['direction']): string {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return '→'
}

function pendingFromProvenance(
  provenance: KpiCardProps['provenance'],
  caption: string | undefined,
): Extract<KitState, { kind: 'integrationPending' }> | undefined {
  if (provenance !== 'pending') return undefined
  return {
    kind: 'integrationPending',
    dependency: 'the data source',
    body: caption ?? 'Connect the integration to see this figure.',
  }
}

/** KPI card with provenance markers and all five KitState variants. */
export function KpiCard({
  label,
  value,
  unit,
  caption,
  delta,
  provenance,
  provenanceNote,
  state,
}: KpiCardProps): ReactElement {
  const labelId = useId()
  const resolved = resolveState(
    state,
    pendingFromProvenance(provenance, caption),
    value === null && state === undefined && provenance !== 'pending'
      ? { kind: 'empty', title: 'No value yet' }
      : undefined,
  )

  const effectiveProvenance =
    resolved.kind === 'integrationPending' ? ('pending' as const) : provenance

  const showProvenanceTag =
    resolved.kind === 'ready' ||
    resolved.kind === 'loading' ||
    resolved.kind === 'integrationPending' ||
    resolved.kind === 'empty'

  return (
    <div className={styles.card}>
      <p id={labelId} className={`${styles.label} column-header`}>
        {label}
      </p>

      <div aria-labelledby={labelId}>
        {resolved.kind === 'loading' ? (
          <>
            <Skeleton region={label} shape="block" height="var(--text-display-line)" />
            {caption !== undefined ? (
              <div className={styles.caption}>
                <Skeleton region={`${label} caption`} shape="text" width="60%" />
              </div>
            ) : null}
          </>
        ) : null}

        {resolved.kind === 'unauthorized' ? (
          <p className={`${styles.unauthorizedMessage} text-body`}>Not available to your role</p>
        ) : null}

        {resolved.kind === 'failure' ? (
          <>
            <p className={`${styles.stateMessage} text-body`}>Did not load</p>
            {resolved.retry !== undefined ? (
              <div className={styles.stateActions}>
                <button
                  type="button"
                  className={`${styles.actionButton} text-body`}
                  onClick={resolved.retry.onAct}
                >
                  {resolved.retry.label}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {resolved.kind === 'empty' ||
        resolved.kind === 'integrationPending' ||
        (resolved.kind === 'ready' && value === null) ? (
          <>
            <div className={styles.valueBlock}>
              <p className={`${styles.value} text-display numeric`}>
                —
                <VisuallyHidden>No value yet</VisuallyHidden>
              </p>
              {showProvenanceTag ? (
                <ProvenanceTag
                  provenance={effectiveProvenance}
                  {...(provenanceNote !== undefined ? { note: provenanceNote } : {})}
                />
              ) : null}
            </div>
            {resolved.kind === 'integrationPending' ? (
              <p className={`${styles.caption} text-caption`}>
                Available when {resolved.dependency} is connected.
              </p>
            ) : resolved.kind === 'empty' && resolved.body !== undefined ? (
              <p className={`${styles.caption} text-caption`}>{resolved.body}</p>
            ) : caption !== undefined ? (
              <p className={`${styles.caption} text-caption`}>{caption}</p>
            ) : null}
          </>
        ) : null}

        {resolved.kind === 'ready' && value !== null ? (
          <>
            <div className={styles.valueBlock}>
              <p className={`${styles.value} text-display numeric`}>
                {value}
                {unit !== undefined ? (
                  unit.length === 1 ? (
                    unit
                  ) : (
                    <>
                      {' '}
                      <span className={styles.unit}>{unit}</span>
                    </>
                  )
                ) : null}
              </p>
              {showProvenanceTag ? (
                <ProvenanceTag
                  provenance={effectiveProvenance}
                  {...(provenanceNote !== undefined ? { note: provenanceNote } : {})}
                />
              ) : null}
            </div>
            {delta !== undefined ? (
              <p
                className={`${styles.delta} text-caption ${deltaToneClass(delta.tone ?? 'neutral')}`}
              >
                <span aria-hidden="true">{deltaArrow(delta.direction)}</span>
                {delta.label}
              </p>
            ) : null}
            {caption !== undefined ? (
              <p className={`${styles.caption} text-caption`}>{caption}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
