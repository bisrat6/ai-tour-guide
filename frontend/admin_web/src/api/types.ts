/**
 * Wire types for the admin API.
 *
 * These are derived from the Postman collection in `adwa_museum/postman/`, which
 * asserts the fields it tests and is silent about the rest. Anything the
 * collection does not pin is marked optional and commented, so an assumption is
 * never mistaken for a verified field. src/api/contract.test.ts keeps the room
 * and item write shapes honest against that collection.
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
  readonly ticketValidationUrl?: string | null
  readonly systemPrompt?: string | null
  readonly defaultVoiceId?: string | null
}

export type ApiRoom = {
  readonly id: string
  readonly museumId: string
  readonly title: string
  readonly storyOrder: number
  readonly roomOverviewText: string
  readonly narrationScript: string
  readonly nextRoomId: string | null
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
}

/** Asserted for GET /admin/museums. Rooms and items are only asserted on `data`. */
export type Paginated<T> = {
  readonly data: readonly T[]
  readonly nextCursor?: string | null
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

/** A museum admin may send the settings fields; `status` is system-admin only. */
export type UpdateMuseumRequest = {
  readonly name?: string
  readonly slug?: string
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
  readonly status?: string
}
