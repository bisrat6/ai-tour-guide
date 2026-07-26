/**
 * The store against a real API, with fetch stubbed.
 *
 * What matters here is the seam: that wire fields land on the right record
 * fields, that narration status is read from whether audio exists rather than
 * invented, and that a refusal the browser could not have predicted comes back
 * attached to the input that caused it.
 */

import { act, render, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthoringStoreProvider, createEmptyRoomDraft, useAuthoringStore } from './authoringStore.tsx'

const MUSEUM_ID = '11111111-1111-4111-8111-111111111111'
const ROOM_ID = '22222222-2222-4222-8222-222222222222'
const ITEM_ID = '33333333-3333-4333-8333-333333333333'

type Store = ReturnType<typeof useAuthoringStore>

let store: Store | null = null
let fetchMock: ReturnType<typeof vi.fn>

function Probe(): null {
  store = useAuthoringStore()
  return null
}

function current(): Store {
  if (store === null) throw new Error('The store was read before the provider rendered.')
  return store
}

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

const apiRoom = {
  id: ROOM_ID,
  museumId: MUSEUM_ID,
  legacyId: null,
  title: 'Origins of Adwa',
  storyOrder: 1,
  roomOverviewText: 'Grounding prose.',
  narrationScript: 'Spoken script.',
  roomAudioUrl: 'https://cdn.test/rooms/origins.mp3',
  nextRoomId: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
}

const apiItem = {
  id: ITEM_ID,
  roomId: ROOM_ID,
  legacyId: null,
  name: 'Horn of Africa Map',
  shortDescription: 'Annotated map.',
  detailText: 'Grounding detail.',
  imageUrl: null,
  displayOrder: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-21T09:30:00.000Z',
}

/** Answers the two hydration calls; anything else is the test's own business. */
function respondToHydration(url: string): Response | null {
  if (url.includes('/admin/rooms')) return json(200, { data: [apiRoom], nextCursor: null })
  if (url.includes('/admin/items')) return json(200, { data: [apiItem], nextCursor: null })
  return null
}

async function mountAndLoad(): Promise<void> {
  render(
    (
      <AuthoringStoreProvider museumId={MUSEUM_ID}>
        <Probe />
      </AuthoringStoreProvider>
    ) as ReactElement,
  )
  await waitFor(() => {
    expect(current().status).toBe('ready')
  })
}

beforeEach(() => {
  store = null
  fetchMock = vi.fn((url: string) => Promise.resolve(respondToHydration(url) ?? json(500, {})))
  vi.stubGlobal('fetch', fetchMock)
})

describe('hydration', () => {
  it('loads the museum named by the provider', async () => {
    await mountAndLoad()

    const requested = String(fetchMock.mock.calls[0]?.[0])
    expect(requested).toContain(`museumId=${MUSEUM_ID}`)
    expect(current().rooms).toHaveLength(1)
    expect(current().rooms[0]?.title).toBe('Origins of Adwa')
  })

  it('takes last edited from the server rather than the clock', async () => {
    await mountAndLoad()
    expect(current().rooms[0]?.lastEditedAt).toBe('2026-07-20T12:00:00.000Z')
    expect(current().items[0]?.lastEditedAt).toBe('2026-07-21T09:30:00.000Z')
  })

  it('reads narration readiness from whether audio exists', async () => {
    await mountAndLoad()
    expect(current().rooms[0]?.narrationStatus).toBe('ready')
  })

  it('reports a failed load rather than showing an empty museum', async () => {
    fetchMock.mockResolvedValue(json(503, { error: { message: 'Database is unreachable.', code: 'UPSTREAM_UNAVAILABLE', requestId: 'r1' } }))

    render(
      (
        <AuthoringStoreProvider museumId={MUSEUM_ID}>
          <Probe />
        </AuthoringStoreProvider>
      ) as ReactElement,
    )

    await waitFor(() => {
      expect(current().status).toBe('error')
    })
    expect(current().loadError).toBe('Database is unreachable.')
  })
})

describe('writes', () => {
  it('sends a created room and keeps the id the server assigned', async () => {
    await mountAndLoad()

    const created = { ...apiRoom, id: '44444444-4444-4444-8444-444444444444', storyOrder: 2, title: 'Aftermath' }
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(json(201, created))
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    let outcome!: Awaited<ReturnType<Store['createRoom']>>
    await act(async () => {
      outcome = await current().createRoom({
        ...createEmptyRoomDraft(),
        title: 'Aftermath',
        storyOrder: '2',
        roomOverviewText: 'Closing grounding.',
        narrationScript: 'Closing narration.',
      })
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.roomId).toBe('44444444-4444-4444-8444-444444444444')
    expect(current().findRoom(outcome.roomId)?.title).toBe('Aftermath')
  })

  /**
   * The browser cannot know another room took this story order a moment ago, so
   * the refusal has to land on the field rather than in a generic banner.
   */
  it('puts a story order conflict on the story order field', async () => {
    await mountAndLoad()

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          json(409, {
            error: {
              message: 'storyOrder is already used by another room in this museum.',
              code: 'CONFLICT',
              requestId: 'r2',
            },
          }),
        )
      }
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    let outcome!: Awaited<ReturnType<Store['createRoom']>>
    await act(async () => {
      outcome = await current().createRoom({
        ...createEmptyRoomDraft(),
        title: 'Clash',
        storyOrder: '7',
        roomOverviewText: 'x',
        narrationScript: 'y',
      })
    })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.storyOrder).toContain('already used')
  })

  it('puts a rejected next-room link on the next-room field', async () => {
    await mountAndLoad()

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          json(422, {
            error: {
              message: 'nextRoomId would create a cycle.',
              code: 'INVALID_ROOM_SEQUENCE',
              requestId: 'r3',
            },
          }),
        )
      }
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    let outcome!: Awaited<ReturnType<Store['createRoom']>>
    await act(async () => {
      outcome = await current().createRoom({
        ...createEmptyRoomDraft(),
        title: 'Loop',
        storyOrder: '8',
        roomOverviewText: 'x',
        narrationScript: 'y',
      })
    })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.errors.nextRoomId).toContain('cycle')
  })

  it('reports a referenced room separately so deleting anyway can be offered', async () => {
    await mountAndLoad()

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(
          json(409, {
            error: {
              message: 'Other rooms reference this room.',
              code: 'ROOM_REFERENCED',
              requestId: 'r4',
            },
          }),
        )
      }
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    let outcome!: Awaited<ReturnType<Store['deleteRoom']>>
    await act(async () => {
      outcome = await current().deleteRoom(ROOM_ID)
    })

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('referenced')
    // The row stays until the delete actually succeeds.
    expect(current().findRoom(ROOM_ID)).toBeDefined()
  })

  it('sends force as the literal string the server parses', async () => {
    await mountAndLoad()

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(json(204, null))
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    await act(async () => {
      await current().deleteRoom(ROOM_ID, { force: true })
    })

    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
    )
    expect(String(deleteCall?.[0])).toContain('force=true')
  })

  it('clears an image by sending null rather than an empty string', async () => {
    await mountAndLoad()

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve(json(200, apiItem))
      return Promise.resolve(respondToHydration(url) ?? json(500, {}))
    })

    await act(async () => {
      await current().updateItem(ITEM_ID, ROOM_ID, {
        name: 'Horn of Africa Map',
        shortDescription: 'Annotated map.',
        detailText: 'Grounding detail.',
        imageUrl: '',
        displayOrder: '0',
      })
    })

    const patch = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH',
    )
    expect(patch).toBeDefined()
    const init = patch?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as { imageUrl: unknown }
    expect(body.imageUrl).toBeNull()
  })

  /**
   * The reorder route rewrites a room's items to a dense 0,1,2…, so a validator
   * demanding 1 or more would make the first item of every reordered room
   * impossible to save.
   */
  it('accepts a display order of zero', async () => {
    await mountAndLoad()
    expect(current().validateItem(
      { name: 'First', shortDescription: '', detailText: '', imageUrl: '', displayOrder: '0' },
      ITEM_ID,
      ROOM_ID,
    )).toEqual({})
  })
})
