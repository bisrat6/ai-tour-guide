import { useMemo, useState, type ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  Button,
  ConfirmDialog,
  Field,
  Select,
  TextArea,
  TextInput,
  useToast,
} from '../../kit/index.ts'
import {
  createEmptyRoomDraft,
  toRoomDraft,
  useAuthoringStore,
  type RoomDraft,
  type RoomDraftErrors,
} from './authoringStore.tsx'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.ts'
import styles from './roomsAuthoring.module.css'

type RoomEditorMode = 'create' | 'edit'

const EMPTY_ROOM_ERRORS: RoomDraftErrors = {}

function roomDraftEquals(left: RoomDraft, right: RoomDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function RoomEditorPage({ mode }: { readonly mode: RoomEditorMode }): ReactElement {
  const navigate = useNavigate()
  const { roomId = '' } = useParams()
  const { show } = useToast()
  const { rooms, listRoomItems, findRoom, createRoom, updateRoom, deleteRoom } = useAuthoringStore()

  const room = mode === 'edit' ? findRoom(roomId) : undefined
  const isMissing = mode === 'edit' && room === undefined
  const baseline = useMemo(() => {
    if (mode === 'create') return createEmptyRoomDraft()
    if (room !== undefined) return toRoomDraft(room)
    return createEmptyRoomDraft()
  }, [mode, room])

  const [draft, setDraft] = useState<RoomDraft>(baseline)
  const [errors, setErrors] = useState<RoomDraftErrors>(EMPTY_ROOM_ERRORS)
  const [discardModalOpen, setDiscardModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const dirty = !roomDraftEquals(draft, baseline)
  const unsavedGuard = useUnsavedChangesGuard(dirty)

  const roomOptions = [
    { value: '', label: 'End of sequence' },
    ...rooms
      .filter((candidate) => candidate.id !== room?.id)
      .map((candidate) => ({ value: candidate.id, label: `${candidate.storyOrder}. ${candidate.title}` })),
  ]

  const itemSummary = room === undefined ? 'Items can be added after the room is created.' : undefined
  const roomItems = room === undefined ? [] : listRoomItems(room.id)

  if (isMissing) {
    return (
      <div className={styles.page}>
        <section className={styles.panelCard}>
          <h1 className="text-title">Room not found</h1>
          <p className={`text-body ${styles.muted}`}>
            The selected room no longer exists in fixtures. Return to the rooms list.
          </p>
          <Button tone="secondary" onClick={() => navigate('..')}>
            Back to rooms
          </Button>
        </section>
      </div>
    )
  }

  function setField<Key extends keyof RoomDraft>(key: Key, value: RoomDraft[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }))
    if (errors[key as keyof RoomDraftErrors] !== undefined) {
      setErrors((current) => ({ ...current, [key]: undefined }))
    }
  }

  function commitSave(): void {
    if (mode === 'create') {
      const created = createRoom(draft)
      if (!created.ok) {
        setErrors(created.errors)
        return
      }
      show({ tone: 'success', message: 'Room created.' })
      unsavedGuard.allowNextNavigation()
      navigate(`../${created.roomId}`, { replace: true })
      return
    }

    const updated = updateRoom(roomId, draft)
    if (!updated.ok) {
      setErrors(updated.errors)
      return
    }
    show({ tone: 'success', message: 'Room saved.' })
    setErrors(EMPTY_ROOM_ERRORS)
  }

  function resetDraft(): void {
    setDraft(baseline)
    setErrors(EMPTY_ROOM_ERRORS)
    setDiscardModalOpen(false)
  }

  function attemptDiscard(): void {
    if (!dirty) {
      resetDraft()
      return
    }
    setDiscardModalOpen(true)
  }

  function attemptDelete(): void {
    if (mode !== 'edit' || room === undefined) return
    deleteRoom(room.id)
    show({ tone: 'success', message: 'Room deleted.' })
    unsavedGuard.allowNextNavigation()
    navigate('..', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">{mode === 'create' ? 'Create room' : `Edit room - ${room?.title}`}</h1>
          <p className={`text-body ${styles.muted}`}>
            Author AI grounding context, narration script, and room sequencing.
          </p>
        </div>
        <Button tone="secondary" onClick={() => navigate('..')}>
          Back to rooms
        </Button>
      </header>

      <section className={styles.editorCard}>
        <div className={styles.formGrid}>
          <Field
            id="room-title"
            label="Title"
            required
            {...(errors.title !== undefined ? { error: errors.title } : {})}
          >
            {(control) => (
              <TextInput
                {...control}
                value={draft.title}
                onChange={(value) => setField('title', value)}
                placeholder="Room title"
              />
            )}
          </Field>

          <Field
            id="room-story-order"
            label="Story order"
            required
            {...(errors.storyOrder !== undefined ? { error: errors.storyOrder } : {})}
          >
            {(control) => (
              <TextInput
                {...control}
                value={draft.storyOrder}
                onChange={(value) => setField('storyOrder', value)}
                inputMode="numeric"
                placeholder="1"
              />
            )}
          </Field>

          <Field
            id="room-next-room"
            label="Next room"
            hint="Select the next room in sequence. Leave blank to end the sequence."
            {...(errors.nextRoomId !== undefined ? { error: errors.nextRoomId } : {})}
          >
            {(control) => (
              <Select
                {...control}
                value={draft.nextRoomId}
                onChange={(value) => setField('nextRoomId', value)}
                options={roomOptions}
              />
            )}
          </Field>

          <Field id="room-overview" label="Overview text (AI grounding)" required>
            {(control) => (
              <TextArea
                {...control}
                value={draft.roomOverviewText}
                onChange={(value) => setField('roomOverviewText', value)}
                rows={5}
                maxLength={700}
                showCount
              />
            )}
          </Field>

          <Field id="room-narration-script" label="Narration script">
            {(control) => (
              <TextArea
                {...control}
                value={draft.narrationScript}
                onChange={(value) => setField('narrationScript', value)}
                rows={8}
                maxLength={3000}
                showCount
              />
            )}
          </Field>
        </div>

        <section className={styles.itemSummaryPanel} aria-label="Item summary">
          <h2 className="text-subtitle">Item summary</h2>
          {itemSummary !== undefined ? (
            <p className={`text-body ${styles.muted}`}>{itemSummary}</p>
          ) : roomItems.length === 0 ? (
            <p className={`text-body ${styles.muted}`}>No items yet in this room.</p>
          ) : (
            <ol className={styles.itemSummaryList}>
              {roomItems.map((item) => (
                <li key={item.id} className={styles.itemSummaryRow}>
                  <span className="text-body">{item.name}</span>
                  <span className={`text-caption ${styles.muted}`}>Display order {item.displayOrder}</span>
                </li>
              ))}
            </ol>
          )}
          {room !== undefined ? (
            <Button tone="ghost" onClick={() => navigate('items')}>
              Manage room items
            </Button>
          ) : null}
        </section>
      </section>

      <div className={styles.stickySaveBar} role="region" aria-label="Room editor actions">
        <p className={`text-caption ${styles.dirtyText}`}>{dirty ? 'Unsaved changes' : 'All changes saved'}</p>
        <div className={styles.saveActions}>
          <Button tone="secondary" onClick={attemptDiscard}>
            Discard
          </Button>
          {mode === 'edit' ? (
            <Button tone="danger" onClick={() => setDeleteModalOpen(true)}>
              Delete room
            </Button>
          ) : null}
          <Button onClick={commitSave}>Save room</Button>
        </div>
      </div>

      <ConfirmDialog
        open={discardModalOpen}
        title="Discard unsaved room edits?"
        entityName={draft.title.trim().length > 0 ? draft.title : 'Untitled room'}
        consequence="has unsaved changes that will be lost."
        confirmLabel="Discard edits"
        tone="danger"
        onCancel={() => setDiscardModalOpen(false)}
        onConfirm={resetDraft}
      />

      <ConfirmDialog
        open={unsavedGuard.navigationConfirmOpen}
        title="Leave with unsaved edits?"
        entityName={draft.title.trim().length > 0 ? draft.title : 'This room'}
        consequence="has unsaved changes that will be lost."
        confirmLabel="Leave page"
        tone="danger"
        onCancel={unsavedGuard.stayOnPage}
        onConfirm={unsavedGuard.leavePage}
      />

      <ConfirmDialog
        open={deleteModalOpen}
        title="Delete room?"
        entityName={room?.title ?? 'Room'}
        consequence="and all items in it will be removed from fixtures."
        confirmLabel="Delete room"
        tone="danger"
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={attemptDelete}
      />
    </div>
  )
}
