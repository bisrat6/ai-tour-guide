/**
 * Every admin API route, typed.
 *
 * One function per route, named for what it does rather than for its verb, so a
 * call site reads as intent. Nothing here holds state: the bearer token lives in
 * the client, and the caller owns loading and error handling.
 */

import { apiRequest } from './client.ts'
import type {
  ApiAdminUser,
  ApiAuditLogEntry,
  ApiItem,
  ApiMuseum,
  ApiPlan,
  ApiRoom,
  BillingStatusResponse,
  CheckoutRequest,
  CheckoutResponse,
  CreateItemRequest,
  CreateMuseumRequest,
  CreateMuseumResponse,
  CreateRoomRequest,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  ManualTierRequest,
  Paginated,
  PaymentStatusResponse,
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

/**
 * The museum's administrators. A museum admin may read its own; only a system
 * admin may read another museum's. There is no route to remove or suspend one.
 */
export function listMuseumAdmins(
  museumId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<Paginated<ApiAdminUser>> {
  return apiRequest<Paginated<ApiAdminUser>>(
    `/admin/museums/${encodeURIComponent(museumId)}/admins`,
    { query: { limit: options.limit, cursor: options.cursor } },
  )
}

// -- Audit log -------------------------------------------------------------

/**
 * Newest first. A museum admin sees only its own museum's trail whatever it
 * asks for; `museumId` narrows a system admin's view to one tenant.
 */
export function listAuditLogs(
  options: { museumId?: string | null; limit?: number; cursor?: string } = {},
): Promise<Paginated<ApiAuditLogEntry>> {
  return apiRequest<Paginated<ApiAuditLogEntry>>('/admin/audit-logs', {
    query: { museumId: options.museumId, limit: options.limit, cursor: options.cursor },
  })
}

// -- Rooms -----------------------------------------------------------------

/**
 * `museumId` is required for a system admin, whose token names no tenant, and
 * ignored for a museum admin, whose token does. Pass the session's museumId and
 * it is correct either way.
 */
export function listRooms(
  options: { museumId?: string | null; limit?: number; cursor?: string } = {},
): Promise<Paginated<ApiRoom>> {
  return apiRequest<Paginated<ApiRoom>>('/admin/rooms', {
    query: { museumId: options.museumId, limit: options.limit, cursor: options.cursor },
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

export function listItems(
  roomId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<Paginated<ApiItem>> {
  return apiRequest<Paginated<ApiItem>>('/admin/items', {
    query: { roomId, limit: options.limit, cursor: options.cursor },
  })
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

// -- Billing ---------------------------------------------------------------

/** Prices come from the database, limits from backend code. */
export function listPlans(): Promise<{ plans: readonly ApiPlan[] }> {
  return apiRequest<{ plans: readonly ApiPlan[] }>('/admin/billing/plans')
}

/** Tier, renewal, usage against the tier's limits, and recent payments. */
export function getBillingStatus(
  options: { museumId?: string | null; limit?: number; cursor?: string } = {},
): Promise<BillingStatusResponse> {
  return apiRequest<BillingStatusResponse>('/admin/billing/status', {
    query: { museumId: options.museumId, limit: options.limit, cursor: options.cursor },
  })
}

/**
 * Opens a payment with the provider and hands back a URL to send the payer to.
 * A second checkout for a tier that already has one pending is a 409.
 */
export function startCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>('/admin/billing/checkout', { method: 'POST', body: input })
}

/**
 * Polled on return from the provider. The server re-verifies anything not yet
 * paid rather than waiting for the reconciler, so the tier can change here.
 */
export function getPayment(txRef: string): Promise<PaymentStatusResponse> {
  return apiRequest<PaymentStatusResponse>(`/admin/billing/payments/${encodeURIComponent(txRef)}`)
}

/** System admin only. Sets a tier without a payment; the reason is recorded. */
export function setMuseumTier(input: ManualTierRequest): Promise<unknown> {
  return apiRequest('/admin/billing/tier', { method: 'POST', body: input })
}
