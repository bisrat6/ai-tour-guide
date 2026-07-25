import { useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  Button,
  ConfirmDialog,
  Field,
  TextArea,
  TextInput,
  useToast,
} from '../../kit/index.ts'
import {
  createEmptyItemDraft,
  toItemDraft,
  useAuthoringStore,
  type ItemDraft,
  type ItemDraftErrors,
} from '../rooms/authoringStore.tsx'
import { useUnsavedChangesGuard } from '../rooms/useUnsavedChangesGuard.ts'
import styles from '../rooms/roomsAuthoring.module.css'

const EMPTY_ITEM_ERRORS: ItemDraftErrors = {}

function itemDraftEquals(left: ItemDraft, right: ItemDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function ItemEditorPage(): ReactElement {
  const navigate = useNavigate()
  const { roomId = '', itemId = '' } = useParams()
  const creating = itemId === 'new'
  const { show } = useToast()
  const { findRoom, findItem, createItem, updateItem, deleteItem } = useAuthoringStore()

  const room = findRoom(roomId)
  const existingItem = creating ? undefined : findItem(itemId)
  const missing = room === undefined || (!creating && existingItem === undefined)

  const baseline = useMemo(() => {
    if (existingItem === undefined) return createEmptyItemDraft()
    return toItemDraft(existingItem)
  }, [existingItem])

  const [draft, setDraft] = useState<ItemDraft>(baseline)
  const [errors, setErrors] = useState<ItemDraftErrors>(EMPTY_ITEM_ERRORS)
  const [discardModalOpen, setDiscardModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const dirty = !itemDraftEquals(draft, baseline)
  const unsavedGuard = useUnsavedChangesGuard(dirty)

  if (missing) {
    return (
      <div className={styles.page}>
        <section className={styles.panelCard}>
          <h1 className="text-title">Item not found</h1>
          <p className={`text-body ${styles.muted}`}>
            The room or item is missing in fixture state. Return to the room items table.
          </p>
          <Button tone="secondary" onClick={() => navigate('..')}>
            Back to room items
          </Button>
        </section>
      </div>
    )
  }

  function setField<Key extends keyof ItemDraft>(key: Key, value: ItemDraft[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    if (errors[key as keyof ItemDraftErrors] !== undefined) {
      setErrors((current) => ({ ...current, [key]: undefined }))
    }
  }

  function commitSave(): void {
    if (room === undefined) return
    if (creating) {
      const created = createItem(room.id, draft)
      if (!created.ok) {
        setErrors(created.errors)
        return
      }
      show({ tone: 'success', message: 'Item created.' })
      unsavedGuard.allowNextNavigation()
      navigate(`../${created.itemId}`, { replace: true })
      return
    }

    const updated = updateItem(itemId, room.id, draft)
    if (!updated.ok) {
      setErrors(updated.errors)
      return
    }
    show({ tone: 'success', message: 'Item saved.' })
    setErrors(EMPTY_ITEM_ERRORS)
  }

  function resetDraft(): void {
    setDraft(baseline)
    setErrors(EMPTY_ITEM_ERRORS)
    setDiscardModalOpen(false)
  }

  function attemptDelete(): void {
    if (existingItem === undefined) return
    deleteItem(existingItem.id)
    show({ tone: 'success', message: 'Item deleted.' })
    unsavedGuard.allowNextNavigation()
    navigate('..', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">
            {creating ? `Create item in ${room?.title}` : `Edit item - ${existingItem?.name}`}
          </h1>
          <p className={`text-body ${styles.muted}`}>
            Visitor-facing copy and grounding details stay in room context.
          </p>
        </div>
        <Button tone="secondary" onClick={() => navigate('..')}>
          Back to items
        </Button>
      </header>

      <section className={styles.editorCard}>
        <div className={styles.formGrid}>
          <Field
            id="item-name"
            label="Name"
            required
            {...(errors.name !== undefined ? { error: errors.name } : {})}
          >
            {(control) => (
              <TextInput
                {...control}
                value={draft.name}
                onChange={(value) => setField('name', value)}
                placeholder="Item name"
              />
            )}
          </Field>

          <Field
            id="item-display-order"
            label="Display order"
            required
            {...(errors.displayOrder !== undefined ? { error: errors.displayOrder } : {})}
          >
            {(control) => (
              <TextInput
                {...control}
                value={draft.displayOrder}
                onChange={(value) => setField('displayOrder', value)}
                inputMode="numeric"
                placeholder="1"
              />
            )}
          </Field>

          <Field id="item-visitor-description" label="Visitor-facing description">
            {(control) => (
              <TextArea
                {...control}
                value={draft.shortDescription}
                onChange={(value) => setField('shortDescription', value)}
                rows={4}
                maxLength={700}
                showCount
              />
            )}
          </Field>

          <Field id="item-grounding-detail" label="Grounding detail">
            {(control) => (
              <TextArea
                {...control}
                value={draft.detailText}
                onChange={(value) => setField('detailText', value)}
                rows={4}
                maxLength={1200}
                showCount
              />
            )}
          </Field>

          <Field id="item-image-url" label="Image URL / upload placeholder">
            {(control) => (
              <TextInput
                {...control}
                value={draft.imageUrl}
                onChange={(value) => setField('imageUrl', value)}
                type="url"
                inputMode="url"
                placeholder="https://..."
              />
            )}
          </Field>
        </div>

        <section className={styles.mediaPanel} aria-label="Image preview">
          <h2 className="text-subtitle">Image preview</h2>
          {draft.imageUrl.trim().length > 0 ? (
            <img className={styles.imagePreview} src={draft.imageUrl} alt={`Preview for ${draft.name || 'item'}`} />
          ) : (
            <div className={styles.mediaPlaceholder}>
              <p className={`text-body ${styles.muted}`}>No image linked yet.</p>
            </div>
          )}
          <Button tone="ghost" disabled disabledReason="Upload integration arrives in a later phase.">
            Upload image (integration pending)
          </Button>
        </section>
      </section>

      <div className={styles.stickySaveBar} role="region" aria-label="Item editor actions">
        <p className={`text-caption ${styles.dirtyText}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</p>
        <div className={styles.saveActions}>
          <Button tone="secondary" onClick={() => (dirty ? setDiscardModalOpen(true) : resetDraft())}>
            Discard
          </Button>
          {!creating ? (
            <Button tone="danger" onClick={() => setDeleteModalOpen(true)}>
              Delete item
            </Button>
          ) : null}
          <Button onClick={commitSave}>Save item</Button>
        </div>
      </div>

      <ConfirmDialog
        open={discardModalOpen}
        title="Discard unsaved item edits?"
        entityName={draft.name.trim().length > 0 ? draft.name : 'Untitled item'}
        consequence="has unsaved changes that will be lost."
        confirmLabel="Discard edits"
        tone="danger"
        onCancel={() => setDiscardModalOpen(false)}
        onConfirm={resetDraft}
      />

      <ConfirmDialog
        open={unsavedGuard.navigationConfirmOpen}
        title="Leave with unsaved edits?"
        entityName={draft.name.trim().length > 0 ? draft.name : 'This item'}
        consequence="has unsaved changes that will be lost."
        confirmLabel="Leave page"
        tone="danger"
        onCancel={unsavedGuard.stayOnPage}
        onConfirm={unsavedGuard.leavePage}
      />

      <ConfirmDialog
        open={deleteModalOpen}
        title="Delete item?"
        entityName={existingItem?.name ?? 'Item'}
        consequence="will be removed from this room."
        confirmLabel="Delete item"
        tone="danger"
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={attemptDelete}
      />
    </div>
  )
}
