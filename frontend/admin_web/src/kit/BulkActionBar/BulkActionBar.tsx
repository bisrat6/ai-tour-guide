import type { ReactElement } from 'react'
import { useCallback, useRef, useState } from 'react'

import styles from './BulkActionBar.module.css'

import { Button } from '../Button/Button.tsx'
import { CrossIcon } from '../internal/CrossIcon.tsx'
import { ConfirmDialog } from '../Modal/ConfirmDialog.tsx'
import { StateBlock } from '../State/StateBlock.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { BulkAction, BulkActionBarProps } from './BulkActionBar.types.ts'
import { resolveState } from '../types.ts'

function formatCount(count: number, noun: BulkActionBarProps['noun']): string {
  if (count === 1) return `1 ${noun.one} selected`
  return `${count} ${noun.many} selected`
}

type BulkActionButtonProps = {
  readonly action: BulkAction
  readonly ariaDisabled: boolean
  readonly busy: boolean
  readonly onPress: (action: BulkAction) => void
}

function BulkActionButton({
  action,
  ariaDisabled,
  busy,
  onPress,
}: BulkActionButtonProps): ReactElement {
  const reasonId = `${action.id}-reason`

  return (
    <button
      type="button"
      className={`${styles.actionButton} text-body`}
      aria-disabled={ariaDisabled ? true : undefined}
      aria-describedby={action.disabledReason !== undefined ? reasonId : undefined}
      aria-busy={busy || undefined}
      onClick={() => {
        if (!ariaDisabled) onPress(action)
      }}
    >
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {action.label}
      {action.disabledReason !== undefined ? (
        <VisuallyHidden id={reasonId}>{action.disabledReason}</VisuallyHidden>
      ) : null}
    </button>
  )
}

/** Bulk selection action bar with confirm flows for destructive batch actions. */
export function BulkActionBar({
  selectedKeys,
  noun,
  actions,
  onClear,
  anchor = 'float',
  state,
}: BulkActionBarProps): ReactElement | null {
  const barRef = useRef<HTMLDivElement>(null)
  const [pendingConfirm, setPendingConfirm] = useState<BulkAction | null>(null)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const resolved = resolveState(state)
  const count = selectedKeys.size

  const handleAction = useCallback(
    (action: BulkAction) => {
      if (action.confirm !== undefined) {
        setPendingConfirm(action)
        return
      }
      setBusyActionId(action.id)
      action.onAct(selectedKeys)
      setBusyActionId(null)
    },
    [selectedKeys],
  )

  const handleConfirm = useCallback(() => {
    if (pendingConfirm === null) return
    setBusyActionId(pendingConfirm.id)
    pendingConfirm.onAct(selectedKeys)
    setPendingConfirm(null)
    setBusyActionId(null)
  }, [pendingConfirm, selectedKeys])

  if (count === 0) return null

  const anchorClass = anchor === 'dock' ? styles.dock : styles.float

  return (
    <>
      <div
        ref={barRef}
        role="region"
        aria-label="Bulk actions"
        className={`${styles.bar} ${anchorClass}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClear()
          }
        }}
      >
        <p className={`${styles.count} text-body`} aria-live="polite">
          {formatCount(count, noun)}
        </p>

        <div className={styles.actions}>
          {actions.map((action) => (
            <BulkActionButton
              key={action.id}
              action={action}
              ariaDisabled={action.disabled === true || resolved.kind === 'loading'}
              busy={busyActionId === action.id}
              onPress={handleAction}
            />
          ))}

          <Button
            tone="ghost"
            iconOnly
            label="Clear selection"
            icon={<CrossIcon />}
            onClick={onClear}
          />
        </div>

        {resolved.kind === 'failure' ? (
          <div className={styles.failure}>
            <StateBlock state={resolved} size="inline" />
          </div>
        ) : null}
      </div>

      {pendingConfirm?.confirm !== undefined ? (
        <ConfirmDialog
          open
          title={pendingConfirm.confirm.title}
          entityName={`${count} ${count === 1 ? noun.one : noun.many}`}
          consequence={pendingConfirm.confirm.consequence}
          confirmLabel={pendingConfirm.confirm.confirmLabel}
          tone={pendingConfirm.tone === 'danger' ? 'danger' : 'primary'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingConfirm(null)}
          returnFocusTo={barRef}
        />
      ) : null}
    </>
  )
}

/** Static replica for gallery stacked views. */
export function BulkActionBarReplica(props: BulkActionBarProps): ReactElement {
  const resolved = resolveState(props.state)
  const count = Math.max(props.selectedKeys.size, 2)
  const anchorClass = props.anchor === 'dock' ? styles.dock : styles.float

  return (
    <div role="presentation" aria-hidden="true" className={`${styles.bar} ${anchorClass}`}>
      <p className={`${styles.count} text-body`}>{formatCount(count, props.noun)}</p>
      <div className={styles.actions}>
        {props.actions.map((action) => (
          <span key={action.id} className="text-body">
            {action.label}
          </span>
        ))}
        <CrossIcon />
      </div>
      {resolved.kind === 'failure' ? (
        <div className={styles.failure}>
          <StateBlock state={resolved} size="inline" announce={false} />
        </div>
      ) : null}
    </div>
  )
}
