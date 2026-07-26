/**
 * The shapes the authoring pages render.
 *
 * Separate from the store so the wire-to-record mapping can import them without
 * importing the store that imports the mapping.
 */

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
  /** Empty string rather than null, because the editor binds it to a text input. */
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
