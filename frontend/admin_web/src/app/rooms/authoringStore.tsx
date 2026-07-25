import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import type { StatusTone } from '../../kit/index.ts'

export type NarrationStatus = 'ready' | 'generating' | 'revision' | 'not_started'

export type RoomRecord = {
  readonly id: string
  readonly museumId: string
  readonly title: string
  readonly storyOrder: number
  readonly roomOverviewText: string
  readonly narrationScript: string
  readonly nextRoomId: string | null
  readonly narrationStatus: NarrationStatus
  readonly lastEditedAt: string
}

export type ItemRecord = {
  readonly id: string
  readonly museumId: string
  readonly roomId: string
  readonly name: string
  readonly shortDescription: string
  readonly detailText: string
  readonly imageUrl: string
  readonly displayOrder: number
  readonly lastEditedAt: string
}

export type RoomDraft = {
  readonly title: string
  readonly storyOrder: string
  readonly roomOverviewText: string
  readonly narrationScript: string
  readonly nextRoomId: string
}

export type ItemDraft = {
  readonly name: string
  readonly shortDescription: string
  readonly detailText: string
  readonly imageUrl: string
  readonly displayOrder: string
}

export type RoomDraftErrors = {
  readonly title?: string
  readonly storyOrder?: string
  readonly nextRoomId?: string
}

export type ItemDraftErrors = {
  readonly name?: string
  readonly displayOrder?: string
}

type AuthoringState = {
  readonly rooms: readonly RoomRecord[]
  readonly items: readonly ItemRecord[]
}

type AuthoringStore = {
  readonly rooms: readonly RoomRecord[]
  readonly items: readonly ItemRecord[]
  readonly findRoom: (roomId: string) => RoomRecord | undefined
  readonly findItem: (itemId: string) => ItemRecord | undefined
  readonly listRoomItems: (roomId: string) => readonly ItemRecord[]
  readonly validateRoom: (draft: RoomDraft, editingRoomId: string | null) => RoomDraftErrors
  readonly validateItem: (draft: ItemDraft, editingItemId: string | null, roomId: string) => ItemDraftErrors
  readonly createRoom: (draft: RoomDraft) => { ok: true; roomId: string } | { ok: false; errors: RoomDraftErrors }
  readonly updateRoom: (
    roomId: string,
    draft: RoomDraft,
  ) => { ok: true } | { ok: false; errors: RoomDraftErrors }
  readonly deleteRoom: (roomId: string) => void
  readonly createItem: (
    roomId: string,
    draft: ItemDraft,
  ) => { ok: true; itemId: string } | { ok: false; errors: ItemDraftErrors }
  readonly updateItem: (
    itemId: string,
    roomId: string,
    draft: ItemDraft,
  ) => { ok: true } | { ok: false; errors: ItemDraftErrors }
  readonly deleteItem: (itemId: string) => void
}

const DEFAULT_MUSEUM_ID = 'museum-adwa'

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

function parsePositiveInteger(input: string): number | null {
  const value = Number.parseInt(input.trim(), 10)
  if (!Number.isFinite(value) || value < 1) return null
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
      narrationStatus: editingRoomId === null ? 'not_started' : museumRooms[0]?.narrationStatus ?? 'not_started',
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
  const displayOrder = parsePositiveInteger(draft.displayOrder)
  if (displayOrder === null) {
    errors.displayOrder = 'Display order must be a positive number.'
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

export function AuthoringStoreProvider({
  children,
  museumId,
}: {
  readonly children: ReactNode
  readonly museumId: string | null
}): ReactElement {
  const resolvedMuseumId = museumId ?? DEFAULT_MUSEUM_ID
  const [byMuseum, setByMuseum] = useState<Record<string, AuthoringState>>(() => ({
    [resolvedMuseumId]: museumStateFromSeed(resolvedMuseumId),
  }))

  const museumState = byMuseum[resolvedMuseumId] ?? museumStateFromSeed(resolvedMuseumId)

  function updateMuseum(update: (current: AuthoringState) => AuthoringState): void {
    setByMuseum((current) => {
      const existing = current[resolvedMuseumId] ?? museumStateFromSeed(resolvedMuseumId)
      return {
        ...current,
        [resolvedMuseumId]: update(existing),
      }
    })
  }

  const value = useMemo<AuthoringStore>(() => {
    const rooms = sortRooms(museumState.rooms.filter((room) => room.museumId === resolvedMuseumId))
    const items = sortItems(museumState.items.filter((item) => item.museumId === resolvedMuseumId))

    return {
      rooms,
      items,
      findRoom: (roomId) => rooms.find((room) => room.id === roomId),
      findItem: (itemId) => items.find((item) => item.id === itemId),
      listRoomItems: (roomId) => items.filter((item) => item.roomId === roomId),
      validateRoom: (draft, editingRoomId) =>
        validateRoomDraftAgainst(museumState, resolvedMuseumId, draft, editingRoomId),
      validateItem: (draft, editingItemId, roomId) =>
        validateItemDraftAgainst(museumState, resolvedMuseumId, roomId, draft, editingItemId),
      createRoom: (draft) => {
        const errors = validateRoomDraftAgainst(museumState, resolvedMuseumId, draft, null)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const roomId = createRoomId(draft.title)
        const storyOrder = parsePositiveInteger(draft.storyOrder)!
        updateMuseum((current) => ({
          ...current,
          rooms: [
            ...current.rooms,
            {
              id: roomId,
              museumId: resolvedMuseumId,
              title: draft.title.trim(),
              storyOrder,
              roomOverviewText: draft.roomOverviewText.trim(),
              narrationScript: draft.narrationScript.trim(),
              nextRoomId: draft.nextRoomId.trim().length > 0 ? draft.nextRoomId : null,
              narrationStatus: 'not_started',
              lastEditedAt: nowIso(),
            },
          ],
        }))
        return { ok: true, roomId }
      },
      updateRoom: (roomId, draft) => {
        const errors = validateRoomDraftAgainst(museumState, resolvedMuseumId, draft, roomId)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const storyOrder = parsePositiveInteger(draft.storyOrder)!
        updateMuseum((current) => ({
          ...current,
          rooms: current.rooms.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  title: draft.title.trim(),
                  storyOrder,
                  roomOverviewText: draft.roomOverviewText.trim(),
                  narrationScript: draft.narrationScript.trim(),
                  nextRoomId: draft.nextRoomId.trim().length > 0 ? draft.nextRoomId : null,
                  lastEditedAt: nowIso(),
                }
              : room,
          ),
        }))
        return { ok: true }
      },
      deleteRoom: (roomId) => {
        updateMuseum((current) => ({
          ...current,
          rooms: current.rooms.filter((room) => room.id !== roomId),
          items: current.items.filter((item) => item.roomId !== roomId),
        }))
      },
      createItem: (roomId, draft) => {
        const errors = validateItemDraftAgainst(museumState, resolvedMuseumId, roomId, draft, null)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const itemId = createItemId(draft.name)
        const displayOrder = parsePositiveInteger(draft.displayOrder)!
        updateMuseum((current) => ({
          ...current,
          items: [
            ...current.items,
            {
              id: itemId,
              museumId: resolvedMuseumId,
              roomId,
              name: draft.name.trim(),
              shortDescription: draft.shortDescription.trim(),
              detailText: draft.detailText.trim(),
              imageUrl: draft.imageUrl.trim(),
              displayOrder,
              lastEditedAt: nowIso(),
            },
          ],
        }))
        return { ok: true, itemId }
      },
      updateItem: (itemId, roomId, draft) => {
        const errors = validateItemDraftAgainst(museumState, resolvedMuseumId, roomId, draft, itemId)
        if (Object.keys(errors).length > 0) return { ok: false, errors }
        const displayOrder = parsePositiveInteger(draft.displayOrder)!
        updateMuseum((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  roomId,
                  name: draft.name.trim(),
                  shortDescription: draft.shortDescription.trim(),
                  detailText: draft.detailText.trim(),
                  imageUrl: draft.imageUrl.trim(),
                  displayOrder,
                  lastEditedAt: nowIso(),
                }
              : item,
          ),
        }))
        return { ok: true }
      },
      deleteItem: (itemId) => {
        updateMuseum((current) => ({
          ...current,
          items: current.items.filter((item) => item.id !== itemId),
        }))
      },
    }
  }, [museumState, resolvedMuseumId])

  return <storeContext.Provider value={value}>{children}</storeContext.Provider>
}

export function useAuthoringStore(): AuthoringStore {
  const context = useContext(storeContext)
  if (context === null) {
    throw new Error('Rooms and items store context is unavailable.')
  }
  return context
}
