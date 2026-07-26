import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import * as api from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import type { StatusTone } from '../../kit/index.ts'
import { itemRejection, roomRejection, toItemRecord, toRoomRecord } from './authoringMapping.ts'
import type {
  ItemDraft,
  ItemDraftErrors,
  ItemRecord,
  NarrationStatus,
  RoomDraft,
  RoomDraftErrors,
  RoomRecord,
} from './authoringRecords.ts'

export type {
  ItemDraft,
  ItemDraftErrors,
  ItemRecord,
  NarrationStatus,
  RoomDraft,
  RoomDraftErrors,
  RoomRecord,
}

type AuthoringState = {
  readonly rooms: readonly RoomRecord[]
  readonly items: readonly ItemRecord[]
}

export type LoadStatus = 'loading' | 'ready' | 'error'

/** A refused write, with anything that belongs to a specific input separated out. */
type WriteFailure<Errors> = {
  readonly ok: false
  readonly errors: Errors
  readonly message?: string
}

type RoomWriteResult = { ok: true; roomId: string } | WriteFailure<RoomDraftErrors>
type RoomUpdateResult = { ok: true } | WriteFailure<RoomDraftErrors>
type ItemWriteResult = { ok: true; itemId: string } | WriteFailure<ItemDraftErrors>
type ItemUpdateResult = { ok: true } | WriteFailure<ItemDraftErrors>

/**
 * `referenced` is kept apart because it is the one failure the caller can act
 * on: another room points here, and deleting anyway is offered rather than
 * refused outright.
 */
export type DeleteRoomResult =
  | { ok: true }
  | { ok: false; reason: 'referenced'; message: string }
  | { ok: false; reason: 'error'; message: string }

export type DeleteItemResult = { ok: true } | { ok: false; message: string }

type AuthoringStore = {
  readonly rooms: readonly RoomRecord[]
  readonly items: readonly ItemRecord[]
  /** False when running on seed content because no API is configured. */
  readonly isLive: boolean
  readonly status: LoadStatus
  readonly loadError: string | null
  readonly reload: () => void
  readonly findRoom: (roomId: string) => RoomRecord | undefined
  readonly findItem: (itemId: string) => ItemRecord | undefined
  readonly listRoomItems: (roomId: string) => readonly ItemRecord[]
  readonly validateRoom: (draft: RoomDraft, editingRoomId: string | null) => RoomDraftErrors
  readonly validateItem: (
    draft: ItemDraft,
    editingItemId: string | null,
    roomId: string,
  ) => ItemDraftErrors
  readonly createRoom: (draft: RoomDraft) => Promise<RoomWriteResult>
  readonly updateRoom: (roomId: string, draft: RoomDraft) => Promise<RoomUpdateResult>
  readonly deleteRoom: (roomId: string, options?: { force?: boolean }) => Promise<DeleteRoomResult>
  readonly createItem: (roomId: string, draft: ItemDraft) => Promise<ItemWriteResult>
  readonly updateItem: (
    itemId: string,
    roomId: string,
    draft: ItemDraft,
  ) => Promise<ItemUpdateResult>
  readonly deleteItem: (itemId: string) => Promise<DeleteItemResult>
}

const DEFAULT_MUSEUM_ID = 'museum-adwa'

/** One request is enough for any museum a person could author by hand. */
const PAGE_SIZE = 200

const BASE_ROOMS: readonly Omit<RoomRecord, 'museumId'>[] = [
  {
    id: 'r-beginning',
    title: 'Origins of Adwa',
    storyOrder: 1,
    roomOverviewText:
      'Introduces the historic context before the campaign and sets grounding context for AI guide prompts.',
    narrationScript:
      'Welcome to the opening room. We begin by tracing the political and social conditions that shaped Adwa.',
    nextRoomId: 'r-mobilization',
    narrationStatus: 'ready',
    lastEditedAt: '2026-07-24T14:23:00.000Z',
  },
  {
    id: 'r-mobilization',
    title: 'Mobilization and Strategy',
    storyOrder: 2,
    roomOverviewText:
      'Covers force assembly, supply corridors, and the strategic decisions that positioned the Ethiopian coalition.',
    narrationScript:
      'In this room, visitors encounter the planning phase: logistics, alliances, and strategic geography.',
    nextRoomId: 'r-battlefield',
    narrationStatus: 'generating',
    lastEditedAt: '2026-07-24T16:08:00.000Z',
  },
  {
    id: 'r-battlefield',
    title: 'Battlefield at Adwa',
    storyOrder: 3,
    roomOverviewText:
      'Primary encounter room. Grounding notes include timeline anchors and unit movement context.',
    narrationScript: 'Pending script refinement for voice cadence and historical cross-check.',
    nextRoomId: 'r-legacy',
    narrationStatus: 'revision',
    lastEditedAt: '2026-07-25T09:42:00.000Z',
  },
  {
    id: 'r-legacy',
    title: 'Legacy and Memory',
    storyOrder: 4,
    roomOverviewText:
      'Explains long-tail effects of Adwa in regional politics and collective memory narratives.',
    narrationScript: '',
    nextRoomId: null,
    narrationStatus: 'not_started',
    lastEditedAt: '2026-07-25T10:19:00.000Z',
  },
]

const BASE_ITEMS: readonly Omit<ItemRecord, 'museumId'>[] = [
  {
    id: 'i-map-1896',
    roomId: 'r-beginning',
    name: 'Horn of Africa Map, 1896',
    shortDescription: 'Annotated map showing political boundaries before the campaign.',
    detailText: 'Used by guide model for place-name disambiguation and pre-war geography context.',
    imageUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&w=1200',
    displayOrder: 1,
    lastEditedAt: '2026-07-24T14:36:00.000Z',
  },
  {
    id: 'i-royal-letter',
    roomId: 'r-beginning',
    name: 'Royal Correspondence Excerpt',
    shortDescription: 'Diplomatic letter excerpt highlighting shifting alliances.',
    detailText: 'Used as citation source for pre-battle diplomatic narrative.',
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&w=1200',
    displayOrder: 2,
    lastEditedAt: '2026-07-24T14:39:00.000Z',
  },
  {
    id: 'i-supply-ledger',
    roomId: 'r-mobilization',
    name: 'Supply Ledger',
    shortDescription: 'Ledger tracing grain and ammunition movement across routes.',
    detailText: 'Supports timeline sections about logistics and constraints.',
    imageUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&w=1200',
    displayOrder: 1,
    lastEditedAt: '2026-07-24T16:22:00.000Z',
  },
  {
    id: 'i-formation-sketch',
    roomId: 'r-battlefield',
    name: 'Formation Sketch',
    shortDescription: 'Field sketch of troop positions at first engagement.',
    detailText: 'Grounding for sequence of tactical descriptions in narration.',
    imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&w=1200',
    displayOrder: 1,
    lastEditedAt: '2026-07-25T09:58:00.000Z',
  },
  {
    id: 'i-commemorative-plaque',
    roomId: 'r-legacy',
    name: 'Commemorative Plaque',
    shortDescription: 'Modern plaque commemorating the battle and its symbolism.',
    detailText: 'Used for interpretation layer around memory and public history.',
    imageUrl: 'https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&w=1200',
    displayOrder: 1,
    lastEditedAt: '2026-07-25T10:21:00.000Z',
  },
]

const EMPTY_STATE: AuthoringState = { rooms: [], items: [] }

const storeContext = createContext<AuthoringStore | null>(null)

function museumStateFromSeed(museumId: string): AuthoringState {
  return {
    rooms: BASE_ROOMS.map((room) => ({ ...room, museumId })),
    items: BASE_ITEMS.map((item) => ({ ...item, museumId })),
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function createRoomId(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `r-${slug || 'room'}-${Date.now().toString(36)}`
}

function createItemId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `i-${slug || 'item'}-${Date.now().toString(36)}`
}

function sortRooms(rooms: readonly RoomRecord[]): readonly RoomRecord[] {
  return [...rooms].sort((left, right) => {
    if (left.storyOrder !== right.storyOrder) return left.storyOrder - right.storyOrder
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
  })
}

function sortItems(items: readonly ItemRecord[]): readonly ItemRecord[] {
  return [...items].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

/** Story order starts at 1 server-side. */
function parsePositiveInteger(input: string): number | null {
  const value = Number.parseInt(input.trim(), 10)
  if (!Number.isFinite(value) || value < 1) return null
  return value
}

/**
 * Display order starts at 0, not 1. The reorder route rewrites a room's items
 * to a dense 0,1,2…, so rejecting 0 would make the first item of every
 * reordered room unsaveable.
 */
function parseDisplayOrder(input: string): number | null {
  const value = Number.parseInt(input.trim(), 10)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

function detectRoomCycle(rooms: readonly RoomRecord[]): boolean {
  const byId = new Map<string, RoomRecord>(rooms.map((room) => [room.id, room]))
  const active = new Set<string>()
  const done = new Set<string>()

  function walk(roomId: string): boolean {
    if (active.has(roomId)) return true
    if (done.has(roomId)) return false
    const room = byId.get(roomId)
    if (room === undefined) return false
    active.add(roomId)
    const nextId = room.nextRoomId
    if (nextId !== null && byId.has(nextId) && walk(nextId)) return true
    active.delete(roomId)
    done.add(roomId)
    return false
  }

  for (const room of rooms) {
    if (walk(room.id)) return true
  }
  return false
}

/**
 * Fast feedback, not the verdict. The server checks story order uniqueness and
 * the next-room sequence again, against rows this browser may not have seen, so
 * a write that passes here can still be refused.
 */
function validateRoomDraftAgainst(
  state: AuthoringState,
  museumId: string,
  draft: RoomDraft,
  editingRoomId: string | null,
): RoomDraftErrors {
  const errors: { title?: string; storyOrder?: string; nextRoomId?: string } = {}
  const title = draft.title.trim()
  const storyOrder = parsePositiveInteger(draft.storyOrder)
  const nextRoomId = draft.nextRoomId.length > 0 ? draft.nextRoomId : null
  const museumRooms = state.rooms.filter((room) => room.museumId === museumId)

  if (title.length === 0) {
    errors.title = 'Enter a room title.'
  }

  if (storyOrder === null) {
    errors.storyOrder = 'Story order must be a positive number.'
  } else {
    const duplicate = museumRooms.find(
      (room) => room.storyOrder === storyOrder && room.id !== editingRoomId,
    )
    if (duplicate !== undefined) {
      errors.storyOrder = `Story order ${storyOrder} is already used by "${duplicate.title}".`
    }
  }

  if (nextRoomId !== null) {
    if (editingRoomId !== null && nextRoomId === editingRoomId) {
      errors.nextRoomId = 'A room cannot point to itself as next room.'
    } else {
      const exists = museumRooms.some((room) => room.id === nextRoomId)
      if (!exists) errors.nextRoomId = 'Next room must be another room in this museum.'
    }
  }

  if (storyOrder !== null) {
    const editedRoomId = editingRoomId ?? 'new-room-candidate'
    const candidate: RoomRecord = {
      id: editedRoomId,
      museumId,
      title,
      storyOrder,
      roomOverviewText: draft.roomOverviewText,
      narrationScript: draft.narrationScript,
      nextRoomId,
      narrationStatus:
        editingRoomId === null ? 'not_started' : (museumRooms[0]?.narrationStatus ?? 'not_started'),
      lastEditedAt: nowIso(),
    }

    const mergedRooms =
      editingRoomId === null
        ? [...museumRooms, candidate]
        : museumRooms.map((room) => (room.id === editingRoomId ? candidate : room))

    if (detectRoomCycle(mergedRooms)) {
      errors.nextRoomId =
        'Next-room links create a cycle. Update selections so the room sequence ends naturally.'
    }
  }

  return errors
}

function validateItemDraftAgainst(
  state: AuthoringState,
  museumId: string,
  roomId: string,
  draft: ItemDraft,
  editingItemId: string | null,
): ItemDraftErrors {
  const errors: { name?: string; displayOrder?: string } = {}
  if (draft.name.trim().length === 0) errors.name = 'Enter an item name.'
  const displayOrder = parseDisplayOrder(draft.displayOrder)
  if (displayOrder === null) {
    errors.displayOrder = 'Display order must be 0 or greater.'
  } else {
    const duplicate = state.items.find(
      (item) =>
        item.museumId === museumId &&
        item.roomId === roomId &&
        item.displayOrder === displayOrder &&
        item.id !== editingItemId,
    )
    if (duplicate !== undefined) {
      errors.displayOrder = `Display order ${displayOrder} is already used by "${duplicate.name}".`
    }
  }
  return errors
}

export function narrationTone(status: NarrationStatus): StatusTone {
  if (status === 'ready') return 'success'
  if (status === 'generating') return 'warning'
  if (status === 'revision') return 'danger'
  return 'neutral'
}

export function narrationLabel(status: NarrationStatus): string {
  if (status === 'ready') return 'Ready'
  if (status === 'generating') return 'Generating'
  if (status === 'revision') return 'Needs revision'
  return 'Not started'
}

export function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime()
  const deltaMinutes = Math.round(deltaMs / 60000)
  if (deltaMinutes < 1) return 'Edited just now'
  if (deltaMinutes < 60) return `Edited ${deltaMinutes}m ago`
  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `Edited ${deltaHours}h ago`
  const deltaDays = Math.round(deltaHours / 24)
  return `Edited ${deltaDays}d ago`
}

export function toRoomDraft(room: RoomRecord): RoomDraft {
  return {
    title: room.title,
    storyOrder: String(room.storyOrder),
    roomOverviewText: room.roomOverviewText,
    narrationScript: room.narrationScript,
    nextRoomId: room.nextRoomId ?? '',
  }
}

export function toItemDraft(item: ItemRecord): ItemDraft {
  return {
    name: item.name,
    shortDescription: item.shortDescription,
    detailText: item.detailText,
    imageUrl: item.imageUrl,
    displayOrder: String(item.displayOrder),
  }
}

const EMPTY_ROOM_DRAFT: RoomDraft = {
  title: '',
  storyOrder: '',
  roomOverviewText: '',
  narrationScript: '',
  nextRoomId: '',
}

const EMPTY_ITEM_DRAFT: ItemDraft = {
  name: '',
  shortDescription: '',
  detailText: '',
  imageUrl: '',
  displayOrder: '',
}

export function createEmptyRoomDraft(): RoomDraft {
  return { ...EMPTY_ROOM_DRAFT }
}

export function createEmptyItemDraft(): ItemDraft {
  return { ...EMPTY_ITEM_DRAFT }
}

/** Follows the cursor so a museum past one page still loads completely. */
async function fetchAllRooms(museumId: string): Promise<readonly RoomRecord[]> {
  const rooms: RoomRecord[] = []
  let cursor: string | undefined

  do {
    const page = await api.listRooms({
      museumId,
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    })
    rooms.push(...page.data.map(toRoomRecord))
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  return rooms
}

async function fetchRoomItems(roomId: string, museumId: string): Promise<readonly ItemRecord[]> {
  const items: ItemRecord[] = []
  let cursor: string | undefined

  do {
    const page = await api.listItems(roomId, {
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    })
    items.push(...page.data.map((item) => toItemRecord(item, museumId)))
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  return items
}

async function fetchMuseumContent(museumId: string): Promise<AuthoringState> {
  const rooms = await fetchAllRooms(museumId)
  const itemsByRoom = await Promise.all(rooms.map((room) => fetchRoomItems(room.id, museumId)))
  return { rooms, items: itemsByRoom.flat() }
}

export function AuthoringStoreProvider({
  children,
  museumId,
}: {
  readonly children: ReactNode
  readonly museumId: string | null
}): ReactElement {
  /**
   * Seed content needs a key to hang state on, and demo mode has no real id.
   * Against a live API there is no substitute: a system admin at `/app` names
   * no museum, and inventing one would read another tenant's content.
   */
  const resolvedMuseumId = museumId ?? (isLiveApi ? null : DEFAULT_MUSEUM_ID)
  const live = isLiveApi && resolvedMuseumId !== null

  const [state, setState] = useState<AuthoringState>(() =>
    live || resolvedMuseumId === null ? EMPTY_STATE : museumStateFromSeed(resolvedMuseumId),
  )
  const [status, setStatus] = useState<LoadStatus>(live ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  /**
   * Guards against a museum switch landing out of order: a slow response for
   * the museum just left must not overwrite the one now shown.
   */
  const requestRef = useRef(0)

  useEffect(() => {
    if (!live || resolvedMuseumId === null) {
      setState(resolvedMuseumId === null ? EMPTY_STATE : museumStateFromSeed(resolvedMuseumId))
      setStatus('ready')
      setLoadError(null)
      return
    }

    const request = requestRef.current + 1
    requestRef.current = request
    setStatus('loading')
    setLoadError(null)

    fetchMuseumContent(resolvedMuseumId)
      .then((loaded) => {
        if (requestRef.current !== request) return
        setState(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (requestRef.current !== request) return
        setState(EMPTY_STATE)
        setStatus('error')
        setLoadError(
          isApiError(error) ? error.message : 'Could not load this museum’s rooms and items.',
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadToken is the trigger, not a value read here
  }, [live, resolvedMuseumId, reloadToken])

  const value = useMemo<AuthoringStore>(() => {
    const scopeId = resolvedMuseumId
    const rooms = sortRooms(
      scopeId === null ? [] : state.rooms.filter((room) => room.museumId === scopeId),
    )
    const items = sortItems(
      scopeId === null ? [] : state.items.filter((item) => item.museumId === scopeId),
    )

    function noMuseum<Errors>(errors: Errors): WriteFailure<Errors> {
      return {
        ok: false,
        errors,
        message: 'Open a museum from the fleet before authoring its content.',
      }
    }

    return {
      rooms,
      items,
      isLive: live,
      status,
      loadError,
      reload,
      findRoom: (roomId) => rooms.find((room) => room.id === roomId),
      findItem: (itemId) => items.find((item) => item.id === itemId),
      listRoomItems: (roomId) => items.filter((item) => item.roomId === roomId),
      validateRoom: (draft, editingRoomId) =>
        validateRoomDraftAgainst(state, scopeId ?? '', draft, editingRoomId),
      validateItem: (draft, editingItemId, roomId) =>
        validateItemDraftAgainst(state, scopeId ?? '', roomId, draft, editingItemId),

      createRoom: async (draft) => {
        if (scopeId === null) return noMuseum<RoomDraftErrors>({})
        const errors = validateRoomDraftAgainst(state, scopeId, draft, null)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const storyOrder = parsePositiveInteger(draft.storyOrder)
        if (storyOrder === null) return { ok: false, errors: { storyOrder: 'Enter a number.' } }

        const nextRoomId = draft.nextRoomId.trim().length > 0 ? draft.nextRoomId.trim() : null
        const fields = {
          title: draft.title.trim(),
          storyOrder,
          roomOverviewText: draft.roomOverviewText.trim(),
          narrationScript: draft.narrationScript.trim(),
          nextRoomId,
        }

        if (!live) {
          const roomId = createRoomId(draft.title)
          setState((current) => ({
            ...current,
            rooms: [
              ...current.rooms,
              {
                ...fields,
                id: roomId,
                museumId: scopeId,
                narrationStatus: 'not_started',
                lastEditedAt: nowIso(),
              },
            ],
          }))
          return { ok: true, roomId }
        }

        try {
          const created = toRoomRecord(await api.createRoom(fields))
          setState((current) => ({ ...current, rooms: [...current.rooms, created] }))
          return { ok: true, roomId: created.id }
        } catch (error) {
          const rejection = roomRejection(error)
          return { ok: false, errors: rejection.errors, ...(rejection.message === undefined ? {} : { message: rejection.message }) }
        }
      },

      updateRoom: async (roomId, draft) => {
        if (scopeId === null) return noMuseum<RoomDraftErrors>({})
        const errors = validateRoomDraftAgainst(state, scopeId, draft, roomId)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const storyOrder = parsePositiveInteger(draft.storyOrder)
        if (storyOrder === null) return { ok: false, errors: { storyOrder: 'Enter a number.' } }

        const nextRoomId = draft.nextRoomId.trim().length > 0 ? draft.nextRoomId.trim() : null
        const fields = {
          title: draft.title.trim(),
          storyOrder,
          roomOverviewText: draft.roomOverviewText.trim(),
          narrationScript: draft.narrationScript.trim(),
          nextRoomId,
        }

        if (!live) {
          setState((current) => ({
            ...current,
            rooms: current.rooms.map((room) =>
              room.id === roomId ? { ...room, ...fields, lastEditedAt: nowIso() } : room,
            ),
          }))
          return { ok: true }
        }

        try {
          const saved = toRoomRecord(await api.updateRoom(roomId, fields))
          setState((current) => ({
            ...current,
            rooms: current.rooms.map((room) => (room.id === roomId ? saved : room)),
          }))
          return { ok: true }
        } catch (error) {
          const rejection = roomRejection(error)
          return { ok: false, errors: rejection.errors, ...(rejection.message === undefined ? {} : { message: rejection.message }) }
        }
      },

      deleteRoom: async (roomId, options = {}) => {
        const forget = (): void => {
          setState((current) => ({
            rooms: current.rooms.filter((room) => room.id !== roomId),
            items: current.items.filter((item) => item.roomId !== roomId),
          }))
        }

        if (!live) {
          forget()
          return { ok: true }
        }

        try {
          await api.deleteRoom(roomId, { force: options.force === true })
          forget()
          /**
           * Forcing nulls the pointer on whichever rooms referenced this one,
           * and the response says nothing about which. Reloading is the only
           * way the list is not left showing links that no longer exist.
           */
          if (options.force === true) reload()
          return { ok: true }
        } catch (error) {
          if (isApiError(error) && error.code === 'ROOM_REFERENCED') {
            return { ok: false, reason: 'referenced', message: error.message }
          }
          return {
            ok: false,
            reason: 'error',
            message: isApiError(error) ? error.message : 'Could not delete that room.',
          }
        }
      },

      createItem: async (roomId, draft) => {
        if (scopeId === null) return noMuseum<ItemDraftErrors>({})
        const errors = validateItemDraftAgainst(state, scopeId, roomId, draft, null)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const displayOrder = parseDisplayOrder(draft.displayOrder)
        if (displayOrder === null) return { ok: false, errors: { displayOrder: 'Enter a number.' } }

        const imageUrl = draft.imageUrl.trim()
        const fields = {
          roomId,
          name: draft.name.trim(),
          shortDescription: draft.shortDescription.trim(),
          detailText: draft.detailText.trim(),
          imageUrl: imageUrl.length > 0 ? imageUrl : null,
          displayOrder,
        }

        if (!live) {
          const itemId = createItemId(draft.name)
          setState((current) => ({
            ...current,
            items: [
              ...current.items,
              {
                ...fields,
                imageUrl,
                id: itemId,
                museumId: scopeId,
                lastEditedAt: nowIso(),
              },
            ],
          }))
          return { ok: true, itemId }
        }

        try {
          const created = toItemRecord(await api.createItem(fields), scopeId)
          setState((current) => ({ ...current, items: [...current.items, created] }))
          return { ok: true, itemId: created.id }
        } catch (error) {
          const rejection = itemRejection(error)
          return { ok: false, errors: rejection.errors, ...(rejection.message === undefined ? {} : { message: rejection.message }) }
        }
      },

      updateItem: async (itemId, roomId, draft) => {
        if (scopeId === null) return noMuseum<ItemDraftErrors>({})
        const errors = validateItemDraftAgainst(state, scopeId, roomId, draft, itemId)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const displayOrder = parseDisplayOrder(draft.displayOrder)
        if (displayOrder === null) return { ok: false, errors: { displayOrder: 'Enter a number.' } }

        const imageUrl = draft.imageUrl.trim()
        const fields = {
          name: draft.name.trim(),
          shortDescription: draft.shortDescription.trim(),
          detailText: draft.detailText.trim(),
          imageUrl: imageUrl.length > 0 ? imageUrl : null,
          displayOrder,
        }

        if (!live) {
          setState((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === itemId
                ? { ...item, ...fields, imageUrl, roomId, lastEditedAt: nowIso() }
                : item,
            ),
          }))
          return { ok: true }
        }

        try {
          const saved = toItemRecord(await api.updateItem(itemId, fields), scopeId)
          setState((current) => ({
            ...current,
            items: current.items.map((item) => (item.id === itemId ? saved : item)),
          }))
          return { ok: true }
        } catch (error) {
          const rejection = itemRejection(error)
          return { ok: false, errors: rejection.errors, ...(rejection.message === undefined ? {} : { message: rejection.message }) }
        }
      },

      deleteItem: async (itemId) => {
        const forget = (): void => {
          setState((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== itemId),
          }))
        }

        if (!live) {
          forget()
          return { ok: true }
        }

        try {
          await api.deleteItem(itemId)
          forget()
          return { ok: true }
        } catch (error) {
          return {
            ok: false,
            message: isApiError(error) ? error.message : 'Could not delete that item.',
          }
        }
      },
    }
  }, [state, resolvedMuseumId, live, status, loadError, reload])

  return <storeContext.Provider value={value}>{children}</storeContext.Provider>
}

export function useAuthoringStore(): AuthoringStore {
  const context = useContext(storeContext)
  if (context === null) {
    throw new Error('Rooms and items store context is unavailable.')
  }
  return context
}
