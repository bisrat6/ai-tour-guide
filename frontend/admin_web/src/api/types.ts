/**
 * Wire types for the admin API.
 *
 * These began as a reading of the Postman collection, which asserts the fields
 * it tests and is silent about the rest. Now that the backend lives in the same
 * repository they are checked against its Zod response schemas under
 * `backend/src/modules/*\/schemas.ts`, which is the actual source of truth, and
 * src/api/contract.test.ts keeps the room and item write shapes honest against
 * `backend/postman/`.
 */

export type ApiRole = 'MUSEUM_ADMIN' | 'SYSTEM_ADMIN'

/** No ONBOARDING server-side, and no delete route — suspension replaces it. */
export type ApiMuseumStatus = 'ACTIVE' | 'SUSPENDED'

export type LoginRequest = {
  readonly email: string
  readonly password: string
}

export type LoginResponse = {
  readonly token: string
  readonly role: ApiRole
  /** Null for a system admin, who belongs to no museum. */
  readonly museumId: string | null
  readonly expiresAt: string
}

export type ApiMuseum = {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly status: ApiMuseumStatus
  readonly ticketValidationUrl: string | null
  readonly systemPrompt: string | null
  readonly defaultVoiceId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type ApiRoom = {
  readonly id: string
  readonly museumId: string
  readonly title: string
  readonly storyOrder: number
  readonly roomOverviewText: string
  readonly narrationScript: string
  readonly nextRoomId: string | null
  /** Non-null once narration audio has been generated and stored for the room. */
  readonly roomAudioUrl: string | null
  /** The room's id in the source JSON, for content imported from data/. */
  readonly legacyId: string | null
  readonly createdAt: string
  readonly updatedAt: string
  /** Only present on GET /admin/rooms/:id, which embeds the room's items. */
  readonly items?: readonly ApiItem[]
}

export type ApiItem = {
  readonly id: string
  readonly roomId: string
  readonly name: string
  readonly shortDescription: string
  readonly detailText: string
  readonly imageUrl: string | null
  readonly displayOrder: number
  readonly legacyId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

/** Every list route emits `nextCursor`, null on the last page. */
export type Paginated<T> = {
  readonly data: readonly T[]
  readonly nextCursor: string | null
}

export type CreateMuseumRequest = {
  readonly name: string
  readonly slug: string
  readonly adminEmail: string
  readonly adminPassword: string
}

/** The museum and its first admin are created in one transaction. */
export type CreateMuseumResponse = {
  readonly museum: ApiMuseum
  readonly admin: {
    readonly id: string
    readonly email: string
    readonly role: ApiRole
    readonly museumId: string
  }
}

/**
 * These four fields are the whole of what a museum can be updated to. Name and
 * slug are set once at creation and have no PATCH — the request schema does not
 * declare them, and Zod strips what it does not declare, so sending either
 * would have returned 200 and changed nothing.
 *
 * `status` is system-admin only and 403s for anyone else.
 */
export type UpdateMuseumRequest = {
  readonly ticketValidationUrl?: string | null
  readonly systemPrompt?: string | null
  readonly defaultVoiceId?: string | null
  readonly status?: ApiMuseumStatus
}

/**
 * A museumId here is ignored in favour of the bearer token, so it is not part of
 * the request type. Scope comes from who you are, never from what you send.
 */
export type CreateRoomRequest = {
  readonly title: string
  readonly storyOrder: number
  readonly roomOverviewText: string
  readonly narrationScript: string
  readonly nextRoomId?: string | null
}

export type UpdateRoomRequest = Partial<CreateRoomRequest>

export type CreateItemRequest = {
  readonly roomId: string
  readonly name: string
  readonly shortDescription: string
  readonly detailText: string
  readonly imageUrl?: string | null
  /** Omit to append to the end of the room. */
  readonly displayOrder?: number
}

export type UpdateItemRequest = {
  readonly name?: string
  readonly shortDescription?: string
  readonly detailText?: string
  /** Send null to clear the image. */
  readonly imageUrl?: string | null
  readonly displayOrder?: number
}

export type HealthResponse = {
  readonly status: string
  /** Round-trip of a real `SELECT 1`, so it reflects the database, not the process. */
  readonly dbLatencyMs: number
  readonly version: string
}

// -- Administrators --------------------------------------------------------

/**
 * There is no name or status column on an administrator - an account exists or
 * it does not. Anything the console shows beyond these fields is invented, and
 * is labelled as such.
 */
export type ApiAdminUser = {
  readonly id: string
  readonly email: string
  readonly role: ApiRole
  readonly museumId: string | null
  readonly lastLoginAt: string | null
  readonly createdAt: string
}

// -- Audit log -------------------------------------------------------------

/**
 * Both of these are plain strings on the row rather than enums, and the server
 * describes them rather than constraining them. Typed as strings for the same
 * reason: a new entity type appearing in the trail must not be a type error
 * here, and the values below are what exist today rather than all there can be.
 *
 * Today: CREATE, UPDATE, DELETE.
 */
export type ApiAuditAction = string

/** Today: Museum, Room, Item, AdminUser, Payment. */
export type ApiAuditEntityType = string

export type ApiAuditLogEntry = {
  readonly id: string
  readonly action: ApiAuditAction
  readonly entityType: ApiAuditEntityType
  readonly entityId: string
  readonly museumId: string | null
  readonly museumName: string | null
  /** Null when nobody was behind the change, as with the payment reconciler. */
  readonly adminUserId: string | null
  readonly adminEmail: string | null
  readonly createdAt: string
}

// -- Billing ---------------------------------------------------------------

export type ApiSubscriptionTier = 'BASIC' | 'PRO' | 'ENTERPRISE'

export type ApiSubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

export type ApiPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'

/** null means unlimited. */
export type ApiTierLimits = {
  readonly maxRooms: number | null
  readonly maxItemsPerRoom: number | null
  readonly maxAdminUsers: number | null
}

/** Decimal amounts cross the wire as strings, so no precision is lost in JSON. */
export type ApiPlan = {
  readonly tier: ApiSubscriptionTier
  readonly displayName: string
  readonly description: string
  readonly amountEtb: string
  readonly currency: string
  readonly periodDays: number
  readonly limits: ApiTierLimits
}

export type ApiPayment = {
  readonly id: string
  readonly txRef: string
  readonly tier: ApiSubscriptionTier
  readonly amountEtb: string
  readonly status: ApiPaymentStatus
  readonly paidAt: string | null
  readonly chapaReference: string | null
  readonly createdAt: string
}

export type BillingStatusResponse = {
  readonly museumId: string
  readonly tier: ApiSubscriptionTier
  readonly subscriptionStatus: ApiSubscriptionStatus
  readonly subscriptionRenewsAt: string | null
  readonly daysUntilRenewal: number | null
  readonly limits: ApiTierLimits
  readonly usage: { readonly rooms: number; readonly adminUsers: number }
  readonly payments: readonly ApiPayment[]
  readonly nextCursor: string | null
}

export type CheckoutRequest = {
  readonly tier: ApiSubscriptionTier
  /** Honoured for a system admin only; a museum admin's own museum always wins. */
  readonly museumId?: string
}

export type CheckoutResponse = {
  readonly txRef: string
  readonly checkoutUrl: string
  readonly tier: ApiSubscriptionTier
  readonly amountEtb: string
  readonly currency: string
  readonly expiresHint: string
}

export type PaymentStatusResponse = {
  readonly txRef: string
  readonly status: ApiPaymentStatus
  readonly tier: ApiSubscriptionTier
  readonly amountEtb: string
  readonly paidAt: string | null
  readonly chapaReference: string | null
  readonly museumTier: ApiSubscriptionTier | null
  readonly subscriptionRenewsAt: string | null
}

/** System admin only. The reason is mandatory so the audit trail is never blank. */
export type ManualTierRequest = {
  readonly museumId: string
  readonly tier: ApiSubscriptionTier
  readonly subscriptionStatus?: ApiSubscriptionStatus
  readonly subscriptionRenewsAt?: string
  readonly reason: string
}
