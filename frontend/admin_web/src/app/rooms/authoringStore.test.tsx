import { act, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  AuthoringStoreProvider,
  createEmptyItemDraft,
  createEmptyRoomDraft,
  toItemDraft,
  toRoomDraft,
  useAuthoringStore,
} from './authoringStore.tsx'

type Store = ReturnType<typeof useAuthoringStore>

let store: Store | null = null

function Probe(): null {
  store = useAuthoringStore()
  return null
}

function current(): Store {
  if (store === null) throw new Error('The store was read before the provider rendered.')
  return store
}

function mount(): void {
  render(
    (
      <AuthoringStoreProvider museumId={null}>
        <Probe />
      </AuthoringStoreProvider>
    ) as ReactElement,
  )
}

/** The store closes over the state of the render that produced it, so each mutation gets its own act(). */
function run<T>(mutation: (store: Store) => T): T {
  let result!: T
  act(() => {
    result = mutation(current())
  })
  return result
}

beforeEach(() => {
  store = null
  mount()
})

describe('rooms', () => {
  it('seeds the tenant with its rooms', () => {
    expect(current().rooms).toHaveLength(4)
    expect(current().rooms[0]?.title).toBe('Origins of Adwa')
  })

  it('stores a created room under roomOverviewText', () => {
    const created = run((s) =>
      s.createRoom({
        ...createEmptyRoomDraft(),
        title: 'Aftermath',
        storyOrder: '5',
        roomOverviewText: 'Grounding prose for the closing room.',
        narrationScript: 'Spoken narration.',
      }),
    )

    expect(created.ok).toBe(true)
    if (!created.ok) return

    const room = current().findRoom(created.roomId)
    expect(room?.roomOverviewText).toBe('Grounding prose for the closing room.')
    expect(room?.narrationScript).toBe('Spoken narration.')
    expect(room?.narrationStatus).toBe('not_started')
    expect(room).not.toHaveProperty('overviewText')
  })

  it('updates roomOverviewText in place', () => {
    const existing = current().rooms[0]!
    const outcome = run((s) =>
      s.updateRoom(existing.id, { ...toRoomDraft(existing), roomOverviewText: 'Rewritten grounding.' }),
    )

    expect(outcome.ok).toBe(true)
    expect(current().findRoom(existing.id)?.roomOverviewText).toBe('Rewritten grounding.')
  })

  it('round-trips a room through toRoomDraft without losing the field', () => {
    const draft = toRoomDraft(current().rooms[0]!)
    expect(draft.roomOverviewText).toBe(current().rooms[0]!.roomOverviewText)
    expect(draft).not.toHaveProperty('overviewText')
  })

  it('rejects a duplicate story order', () => {
    const outcome = run((s) =>
      s.createRoom({ ...createEmptyRoomDraft(), title: 'Clash', storyOrder: '1' }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.storyOrder).toContain('already used')
  })

  it('rejects a room without a title', () => {
    const outcome = run((s) => s.createRoom({ ...createEmptyRoomDraft(), storyOrder: '9' }))

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.title).toBeDefined()
  })

  it('rejects a room that points at itself', () => {
    const existing = current().rooms[0]!
    const outcome = run((s) =>
      s.updateRoom(existing.id, { ...toRoomDraft(existing), nextRoomId: existing.id }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.nextRoomId).toBeDefined()
  })

  it('cascades to the room items on delete', () => {
    const target = current().rooms[0]!
    expect(current().listRoomItems(target.id).length).toBeGreaterThan(0)

    run((s) => s.deleteRoom(target.id))

    expect(current().findRoom(target.id)).toBeUndefined()
    expect(current().listRoomItems(target.id)).toHaveLength(0)
  })
})

describe('items', () => {
  it('stores a created item under shortDescription and detailText', () => {
    const roomId = current().rooms[0]!.id
    const created = run((s) =>
      s.createItem(roomId, {
        ...createEmptyItemDraft(),
        name: 'Field Telegram',
        shortDescription: 'A dispatch sent from the front.',
        detailText: 'Grounding context the guide model cites.',
        displayOrder: '9',
      }),
    )

    expect(created.ok).toBe(true)
    if (!created.ok) return

    const item = current().findItem(created.itemId)
    expect(item?.shortDescription).toBe('A dispatch sent from the front.')
    expect(item?.detailText).toBe('Grounding context the guide model cites.')
    expect(item).not.toHaveProperty('visitorDescription')
    expect(item).not.toHaveProperty('groundingDetail')
  })

  it('updates both renamed fields in place', () => {
    const existing = current().items[0]!
    const outcome = run((s) =>
      s.updateItem(existing.id, existing.roomId, {
        ...toItemDraft(existing),
        shortDescription: 'Revised visitor copy.',
        detailText: 'Revised grounding copy.',
      }),
    )

    expect(outcome.ok).toBe(true)

    const updated = current().findItem(existing.id)
    expect(updated?.shortDescription).toBe('Revised visitor copy.')
    expect(updated?.detailText).toBe('Revised grounding copy.')
  })

  it('round-trips an item through toItemDraft without losing the fields', () => {
    const item = current().items[0]!
    const draft = toItemDraft(item)

    expect(draft.shortDescription).toBe(item.shortDescription)
    expect(draft.detailText).toBe(item.detailText)
    expect(draft).not.toHaveProperty('visitorDescription')
    expect(draft).not.toHaveProperty('groundingDetail')
  })

  it('rejects a duplicate display order inside one room', () => {
    const existing = current().items[0]!
    const outcome = run((s) =>
      s.createItem(existing.roomId, {
        ...createEmptyItemDraft(),
        name: 'Collides',
        displayOrder: String(existing.displayOrder),
      }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.displayOrder).toContain('already used')
  })

  it('removes only the deleted item', () => {
    const target = current().items[0]!
    const before = current().items.length

    run((s) => s.deleteItem(target.id))

    expect(current().findItem(target.id)).toBeUndefined()
    expect(current().items).toHaveLength(before - 1)
  })
})
