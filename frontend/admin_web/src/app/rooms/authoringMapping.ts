/**
 * Between the wire and the authoring store.
 *
 * Two jobs: turn an API room or item into the record the pages render, and turn
 * a rejected write into errors that land on the right input. Both are kept out
 * of the store so the store reads as state management rather than translation.
 */

import { isApiError } from '../../api/errors.ts'
import type { ApiItem, ApiRoom } from '../../api/types.ts'
import type { ItemDraftErrors, ItemRecord, NarrationStatus, RoomDraftErrors, RoomRecord } from './authoringRecords.ts'

/**
 * The server records whether narration audio exists, not how its authoring is
 * going. `generating` and `revision` are editorial states with nothing behind
 * them, so a live room is only ever one of these two.
 */
function narrationStatusFor(room: ApiRoom): NarrationStatus {
  return room.roomAudioUrl === null ? 'not_started' : 'ready'
}

export function toRoomRecord(room: ApiRoom): RoomRecord {
  return {
    id: room.id,
    museumId: room.museumId,
    title: room.title,
    storyOrder: room.storyOrder,
    roomOverviewText: room.roomOverviewText,
    narrationScript: room.narrationScript,
    nextRoomId: room.nextRoomId,
    narrationStatus: narrationStatusFor(room),
    lastEditedAt: room.updatedAt,
  }
}

/** An item carries no museumId of its own; it inherits its room's. */
export function toItemRecord(item: ApiItem, museumId: string): ItemRecord {
  return {
    id: item.id,
    museumId,
    roomId: item.roomId,
    name: item.name,
    shortDescription: item.shortDescription,
    detailText: item.detailText,
    imageUrl: item.imageUrl ?? '',
    displayOrder: item.displayOrder,
    lastEditedAt: item.updatedAt,
  }
}

export type Rejection<Errors> = {
  readonly errors: Errors
  /** Set when the refusal belongs to the form as a whole rather than one field. */
  readonly message: string | undefined
}

const UNEXPECTED = 'Something went wrong saving that. Try again.'

/**
 * A room write can be refused four ways, and only the last is a surprise:
 * field validation, a story order already taken, a next-room link the server
 * will not allow, or something else.
 */
export function roomRejection(error: unknown): Rejection<RoomDraftErrors> {
  if (!isApiError(error)) return { errors: {}, message: UNEXPECTED }

  if (error.code === 'VALIDATION_ERROR') {
    const errors: { title?: string; storyOrder?: string; nextRoomId?: string } = {}
    let unmatched: string | undefined

    for (const detail of error.details) {
      const message = detail.message ?? error.message
      if (detail.path === 'title') errors.title = message
      else if (detail.path === 'storyOrder') errors.storyOrder = message
      else if (detail.path === 'nextRoomId') errors.nextRoomId = message
      else unmatched = message
    }

    if (Object.keys(errors).length > 0) {
      return { errors, message: unmatched }
    }
    return { errors: {}, message: unmatched ?? error.message }
  }

  // storyOrder is the only uniqueness a room has, so a conflict is always it.
  if (error.code === 'CONFLICT') {
    return { errors: { storyOrder: error.message }, message: undefined }
  }

  if (error.code === 'INVALID_ROOM_SEQUENCE') {
    return { errors: { nextRoomId: error.message }, message: undefined }
  }

  return { errors: {}, message: error.message }
}

export function itemRejection(error: unknown): Rejection<ItemDraftErrors> {
  if (!isApiError(error)) return { errors: {}, message: UNEXPECTED }

  if (error.code === 'VALIDATION_ERROR') {
    const errors: { name?: string; displayOrder?: string } = {}
    let unmatched: string | undefined

    for (const detail of error.details) {
      const message = detail.message ?? error.message
      if (detail.path === 'name') errors.name = message
      else if (detail.path === 'displayOrder') errors.displayOrder = message
      else unmatched = message
    }

    if (Object.keys(errors).length > 0) {
      return { errors, message: unmatched }
    }
    return { errors: {}, message: unmatched ?? error.message }
  }

  return { errors: {}, message: error.message }
}
