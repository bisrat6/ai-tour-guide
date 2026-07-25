import type { ReactElement } from 'react'
import { useRef, useState } from 'react'

import styles from './OverlaySpecimens.module.css'

import { BulkActionBar, BulkActionBarReplica } from '../../kit/BulkActionBar/BulkActionBar.tsx'
import { Button } from '../../kit/Button/Button.tsx'
import { ConfirmDialog } from '../../kit/Modal/ConfirmDialog.tsx'
import { Modal } from '../../kit/Modal/Modal.tsx'
import { PeekPanel, PeekPanelReplica } from '../../kit/PeekPanel/PeekPanel.tsx'
import { StateBlock } from '../../kit/State/StateBlock.tsx'
import { ToastRegion } from '../../kit/Toast/ToastRegion.tsx'
import { useToast } from '../../kit/Toast/useToast.ts'
import { PEEK_RECORD, PEEK_TABS } from '../fixtures/peek.ts'
import { TOAST_FIXTURES } from '../fixtures/toasts.ts'
import { GallerySpecimen } from '../GallerySpecimen.tsx'
import type { StateFilter } from '../GalleryNav.tsx'

const BULK_ACTIONS = [
  {
    id: 'publish',
    label: 'Publish',
    tone: 'secondary' as const,
    onAct: () => undefined,
  },
  {
    id: 'archive',
    label: 'Archive',
    tone: 'danger' as const,
    confirm: {
      title: 'Archive selected museums?',
      consequence: 'will be hidden from visitors immediately. Content stays in place.',
      confirmLabel: 'Archive museums',
    },
    onAct: () => undefined,
  },
]

const SELECTED = new Set(['harar', 'lalibela'])

type OverlaySpecimenProps = {
  readonly planeMode: 'both' | 'tenant' | 'control'
  readonly stateFilter: StateFilter
}

function StateNote({ children }: { readonly children: string }): ReactElement {
  return <p className={`${styles.stateNote} text-caption`}>{children}</p>
}

function KeyboardSequence({ children }: { readonly children: string }): ReactElement {
  return (
    <pre className={styles.keyboardSequence} aria-label="Keyboard sequence">
      {children}
    </pre>
  )
}

function ModalSpecimenContent(): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className={styles.overlaySpecimen}>
      <KeyboardSequence>
        {`Tab → Open modal → Enter
Tab cycles Cancel then Save (focus trapped)
Escape → focus returns to Open modal
Danger confirm: Tab → Open suspend dialog → Enter on Cancel (default focus)`}
      </KeyboardSequence>
      <Button ref={triggerRef} tone="secondary" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Button tone="danger" onClick={() => setConfirmOpen(true)}>
        Open suspend dialog
      </Button>
      <p className={`${styles.replicaLabel} text-caption`}>Static replica (ready)</p>
      <div className={styles.modalReplicaHost}>
        <div className={styles.modalReplicaScrim} aria-hidden="true" />
        <div className={styles.modalReplicaDialog}>
          <div
            role="presentation"
            aria-hidden="true"
            className="text-body"
            style={{
              background: 'var(--overlay-surface)',
              border: 'var(--border-hairline-width) solid var(--panel-border)',
              borderRadius: 'var(--overlay-radius)',
              boxShadow: 'var(--panel-shadow)',
              padding: 'var(--space-4)',
            }}
          >
            <h3 className="text-subtitle">Edit room</h3>
            <p className="text-body-large" style={{ color: 'var(--content-secondary)' }}>
              Change the title and order, then save.
            </p>
          </div>
        </div>
      </div>
      <Modal
        open={open}
        title="Edit room"
        description="Change the title and order, then save."
        returnFocusTo={triggerRef}
        footer={
          <>
            <Button tone="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button tone="primary" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
      >
        <p className="text-body">Room title and order fields would appear here.</p>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        title="Suspend this museum?"
        entityName="Harar Museum"
        consequence="will be hidden from visitors immediately. Its content stays in place and you can reinstate it later."
        confirmLabel="Suspend museum"
        tone="danger"
        returnFocusTo={triggerRef}
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

function ToastSpecimenContent(): ReactElement {
  const { show } = useToast()
  const [staticToasts, setStaticToasts] = useState(() =>
    TOAST_FIXTURES.map((fixture, index) => ({ ...fixture, id: `static-${index}` })),
  )

  return (
    <div className={styles.overlaySpecimen}>
      <KeyboardSequence>
        {`Tab → Show success toast → Enter (focus stays on trigger)
Tab to page end → Dismiss on toast
Tab → Show failure toast → Tab to Try again → Enter
Escape while focused in toast region dismisses toast`}
      </KeyboardSequence>
      <Button tone="secondary" onClick={() => show(TOAST_FIXTURES[0])}>
        Show success toast
      </Button>
      <Button tone="secondary" onClick={() => show(TOAST_FIXTURES[1])}>
        Show failure toast
      </Button>
      <Button tone="secondary" onClick={() => show(TOAST_FIXTURES[2])}>
        Show neutral toast
      </Button>
      <p className={`${styles.replicaLabel} text-caption`}>Static replica (all tones)</p>
      <div className={styles.toastReplicaStack}>
        <ToastRegion
          toasts={staticToasts}
          onDismiss={(id) => setStaticToasts((current) => current.filter((t) => t.id !== id))}
        />
      </div>
    </div>
  )
}

function PeekPanelSpecimenContent(): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState<string>(PEEK_TABS[0].id)

  return (
    <div className={styles.overlaySpecimen}>
      <KeyboardSequence>
        {`Tab → Open peek panel → Enter → focus moves to panel
Tab → Close → Enter → focus returns to Open peek panel
Escape anywhere inside panel closes and returns focus
Sheet variant (<1024px): focus trapped, scrim click closes`}
      </KeyboardSequence>
      <div className={styles.tableStub} data-table-region tabIndex={-1}>
        Table stub — selection preserved while peek is open.
      </div>
      <Button ref={triggerRef} tone="secondary" onClick={() => setOpen(true)}>
        Open peek panel
      </Button>
      <p className={`${styles.replicaLabel} text-caption`}>Static replica (overlay)</p>
      <PeekPanelReplica
        title={PEEK_RECORD.title}
        museumName={PEEK_RECORD.museumName}
        subtitle={PEEK_RECORD.subtitle}
        status={PEEK_RECORD.status}
        tabs={PEEK_TABS.map((tab) => ({
          ...tab,
          content: <p className="text-body">{tab.content}</p>,
        }))}
        activeTabId={activeTabId}
        variant="overlay"
      >
        <p className="text-body">{PEEK_TABS[0].content}</p>
      </PeekPanelReplica>
      <PeekPanel
        open={open}
        title={PEEK_RECORD.title}
        museumName={PEEK_RECORD.museumName}
        subtitle={PEEK_RECORD.subtitle}
        status={PEEK_RECORD.status}
        tabs={PEEK_TABS.map((tab) => ({
          ...tab,
          content: <p className="text-body">{tab.content}</p>,
        }))}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        returnFocusTo={triggerRef}
        onClose={() => setOpen(false)}
        variant="overlay"
        footer={
          <Button tone="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      />
    </div>
  )
}

function BulkActionBarSpecimenContent(): ReactElement {
  const [selected, setSelected] = useState(SELECTED)

  return (
    <div className={styles.overlaySpecimen}>
      <KeyboardSequence>
        {`Select rows → Tab into bulk bar (focus not auto-moved on appear)
Tab through actions → Archive → Enter → confirm dialog (Cancel focused)
Escape inside bar clears selection
aria-live announces "2 museums selected" on change`}
      </KeyboardSequence>
      <div className={styles.tableStub} data-table-region tabIndex={-1}>
        Table stub with {selected.size} rows selected.
      </div>
      <BulkActionBar
        selectedKeys={selected}
        noun={{ one: 'museum', many: 'museums' }}
        actions={BULK_ACTIONS}
        onClear={() => setSelected(new Set())}
      />
      <p className={`${styles.replicaLabel} text-caption`}>Static replica (ready + failure)</p>
      <BulkActionBarReplica
        selectedKeys={selected}
        noun={{ one: 'museum', many: 'museums' }}
        actions={BULK_ACTIONS}
        onClear={() => undefined}
      />
      <BulkActionBarReplica
        selectedKeys={selected}
        noun={{ one: 'museum', many: 'museums' }}
        actions={BULK_ACTIONS}
        onClear={() => undefined}
        state={{
          kind: 'failure',
          title: '1 of 2 did not update',
          body: 'The request failed. Try again.',
          retry: { label: 'Try again', onAct: () => undefined },
        }}
      />
    </div>
  )
}

export function ModalGallerySpecimen(props: OverlaySpecimenProps): ReactElement {
  return (
    <GallerySpecimen
      id="modal"
      name="Modal"
      contract="Modal with focus trap, inert background, focus return. ConfirmDialog defaults Cancel focus for danger."
      {...props}
    >
      <div className={styles.stateGrid}>
        <ModalSpecimenContent />
        <StateNote>
          Empty does not apply: an empty modal should not be opened. Unauthorized does not apply:
          forbidden actions have no trigger.
        </StateNote>
        <StateBlock
          state={{
            kind: 'failure',
            title: 'That did not save',
            body: 'The request timed out. Try again.',
            retry: { label: 'Try again', onAct: () => undefined },
          }}
          size="inline"
          announce={false}
        />
        <StateBlock state={{ kind: 'loading', label: 'form fields' }} size="inline" announce={false} />
      </div>
    </GallerySpecimen>
  )
}

export function ToastGallerySpecimen(props: OverlaySpecimenProps): ReactElement {
  return (
    <GallerySpecimen
      id="toast"
      name="Toast"
      contract="ToastProvider, polite/assertive live regions, no focus steal, pause on hover/focus."
      {...props}
    >
      <ToastSpecimenContent />
      <StateNote>
        Loading, empty, failure, unauthorized and integration-pending do not apply: a toast is a
        transient outcome message, not a data region.
      </StateNote>
    </GallerySpecimen>
  )
}

export function PeekPanelGallerySpecimen(props: OverlaySpecimenProps): ReactElement {
  return (
    <GallerySpecimen
      id="peek-panel"
      name="Peek panel"
      contract="Overlay vs sheet variants, Escape closes, focus return, Tabs tab strip."
      {...props}
    >
      <PeekPanelSpecimenContent />
    </GallerySpecimen>
  )
}

export function BulkActionBarGallerySpecimen(props: OverlaySpecimenProps): ReactElement {
  return (
    <GallerySpecimen
      id="bulk-action-bar"
      name="Bulk-action bar"
      contract="Float/dock anchor, aria-live count, ConfirmDialog for destructive batch actions."
      {...props}
    >
      <BulkActionBarSpecimenContent />
      <StateNote>
        Empty does not apply: zero selection hides the bar. Unauthorized does not apply: forbidden
        actions are absent from the action list.
      </StateNote>
    </GallerySpecimen>
  )
}
