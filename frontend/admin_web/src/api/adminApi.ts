/**
 * Every admin API route, typed.
 *
 * One function per route, named for what it does rather than for its verb, so a
 * call site reads as intent. Nothing here holds state: the bearer token lives in
 * the client, and the caller owns loading and error handling.
 */

import { apiRequest } from './client.ts'
import type {
  ApiItem,
  ApiMuseum,
  ApiRoom,
  CreateItemRequest,
  CreateMuseumRequest,
  CreateMuseumResponse,
  CreateRoomRequest,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  Paginated,
  UpdateItemRequest,
  UpdateMuseumRequest,
  UpdateRoomRequest,
} from './types.ts'

// -- Service ---------------------------------------------------------------

/** Unauthenticated. Also the cheapest way to wake a sleeping Render service. */
export function checkHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health')
}

// -- Auth ------------------------------------------------------------------

/**
 * Rate limited to 10 attempts per IP per 15 minutes, so a 429 here is the
 * limiter working rather than a bug.
 */
export function signIn(credentials: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/admin/login', {
    method: 'POST',
    body: credentials,
    token: null,
  })
}

// -- Museums ---------------------------------------------------------------

/** System admin only; a museum admin receives 403 FORBIDDEN. */
export function listMuseums(options: { limit?: number; cursor?: string } = {}): Promise<
  Paginated<ApiMuseum>
> {
  return apiRequest<Paginated<ApiMuseum>>('/admin/museums', {
    query: { limit: options.limit, cursor: options.cursor },
  })
}

export function getMuseum(museumId: string): Promise<ApiMuseum> {
  return apiRequest<ApiMuseum>(`/admin/museums/${encodeURIComponent(museumId)}`)
}

/** Creates the museum and its first administrator together. */
export function createMuseum(input: CreateMuseumRequest): Promise<CreateMuseumResponse> {
  return apiRequest<CreateMuseumResponse>('/admin/museums', { method: 'POST', body: input })
}

/** A museum admin may change its own settings, but `status` is operator-only. */
export function updateMuseum(museumId: string, input: UpdateMuseumRequest): Promise<ApiMuseum> {
  return apiRequest<ApiMuseum>(`/admin/museums/${encodeURIComponent(museumId)}`, {
    method: 'PATCH',
    body: input,
  })
}

export function addMuseumAdmin(
  museumId: string,
  input: { email: string; password: string },
): Promise<{ id: string; email: string; role: string; museumId: string }> {
  return apiRequest(`/admin/museums/${encodeURIComponent(museumId)}/admins`, {
    method: 'POST',
    body: input,
  })
}

// -- Rooms -----------------------------------------------------------------

/**
 * `museumId` is required for a system admin, whose token names no tenant, and
 * ignored for a museum admin, whose token does. Pass the session's museumId and
 * it is correct either way.
 */
export function listRooms(options: { museumId?: string | null; limit?: number } = {}): Promise<
  Paginated<ApiRoom>
> {
  return apiRequest<Paginated<ApiRoom>>('/admin/rooms', {
    query: { museumId: options.museumId, limit: options.limit },
  })
}

/** Embeds the room's items, so listing them separately is unnecessary. */
export function getRoom(roomId: string): Promise<ApiRoom> {
  return apiRequest<ApiRoom>(`/admin/rooms/${encodeURIComponent(roomId)}`)
}

export function createRoom(input: CreateRoomRequest): Promise<ApiRoom> {
  return apiRequest<ApiRoom>('/admin/rooms', { method: 'POST', body: input })
}

export function updateRoom(roomId: string, input: UpdateRoomRequest): Promise<ApiRoom> {
  return apiRequest<ApiRoom>(`/admin/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: input,
  })
}

/**
 * Deleting a room another room points at fails with 409 ROOM_REFERENCED unless
 * forced, which nulls the dangling pointer.
 *
 * `force` must be the literal string 'true' or 'false'. It was once parsed with
 * `z.coerce.boolean()`, where `Boolean('false')` is `true`, so a UI sending a
 * checkbox state silently destroyed sequence links. Sending a real boolean or a
 * `0` is now a 400, and this signature is what keeps that from coming back.
 */
export function deleteRoom(roomId: string, options: { force?: boolean } = {}): Promise<void> {
  return apiRequest<void>(`/admin/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
    query: { force: options.force === true ? 'true' : 'false' },
  })
}

// -- Items -----------------------------------------------------------------

export function listItems(roomId: string): Promise<Paginated<ApiItem>> {
  return apiRequest<Paginated<ApiItem>>('/admin/items', { query: { roomId } })
}

export function createItem(input: CreateItemRequest): Promise<ApiItem> {
  return apiRequest<ApiItem>('/admin/items', { method: 'POST', body: input })
}

export function updateItem(itemId: string, input: UpdateItemRequest): Promise<ApiItem> {
  return apiRequest<ApiItem>(`/admin/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: input,
  })
}

export function deleteItem(itemId: string): Promise<void> {
  return apiRequest<void>(`/admin/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
}

/**
 * Rewrites displayOrder to a dense 0,1,2… in the order given. The list must be
 * complete: a partial set is rejected outright rather than partially applied.
 */
export function reorderRoomItems(roomId: string, itemIds: readonly string[]): Promise<void> {
  return apiRequest<void>(`/admin/rooms/${encodeURIComponent(roomId)}/items/order`, {
    method: 'PATCH',
    body: { itemIds },
  })
}
