/**
 * Pins the frontend's authoring vocabulary to the backend contract.
 *
 * The source of truth is the Postman collection the backend team maintains, not
 * a copy of it kept here — so if the API renames a field and the collection is
 * updated, this fails until the frontend follows. It is the guard that stops the
 * room/item field alignment from silently drifting back apart.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createEmptyItemDraft, createEmptyRoomDraft } from '../app/rooms/authoringStore.tsx'

const here = dirname(fileURLToPath(import.meta.url))
const collectionPath = join(here, '..', '..', '..', 'postman', 'Adwa-Admin-API.postman_collection.json')

/**
 * The collection is deliberately not committed, so this suite only runs where a
 * copy is present. Skipping keeps a fresh clone green, but it also means CI
 * proves nothing here — drop the folder in before trusting a green run.
 */
const hasCollection = existsSync(collectionPath)

type PostmanRequest = {
  readonly method?: string
  readonly url?: { readonly raw?: string } | string
  readonly body?: { readonly raw?: string }
}

type PostmanNode = {
  readonly name?: string
  readonly item?: readonly PostmanNode[]
  readonly request?: PostmanRequest
}

function readCollection(): readonly PostmanNode[] {
  const raw = readFileSync(collectionPath, 'utf8')
  const parsed = JSON.parse(raw) as { readonly item?: readonly PostmanNode[] }
  return parsed.item ?? []
}

function rawUrl(request: PostmanRequest): string {
  if (typeof request.url === 'string') return request.url
  return request.url?.raw ?? ''
}

/**
 * Collection bodies are templates: `"{{museumBId}}"` in string position and a
 * bare `{{storyOrderA}}` in number position. Neither is valid JSON, so both are
 * substituted before parsing.
 */
function parseTemplatedJson(raw: string, requestName: string): Record<string, unknown> {
  const substituted = raw.replace(/"\{\{[^}]+\}\}"/g, '"x"').replace(/\{\{[^}]+\}\}/g, '0')
  try {
    return JSON.parse(substituted) as Record<string, unknown>
  } catch (cause) {
    throw new Error(`Could not parse the body of Postman request "${requestName}": ${String(cause)}`)
  }
}

/** Union of every JSON body key sent by requests matching `method` and the path. */
function bodyKeysFor(method: string, path: string): readonly string[] {
  const keys = new Set<string>()
  let matched = 0

  function walk(nodes: readonly PostmanNode[]): void {
    for (const node of nodes) {
      if (node.item !== undefined) {
        walk(node.item)
        continue
      }
      const request = node.request
      if (request === undefined) continue
      if ((request.method ?? '').toUpperCase() !== method) continue
      if (rawUrl(request).replace('{{baseUrl}}', '').split('?')[0] !== path) continue

      matched += 1
      const raw = request.body?.raw
      if (raw === undefined) continue
      for (const key of Object.keys(parseTemplatedJson(raw, node.name ?? path))) keys.add(key)
    }
  }

  walk(readCollection())

  if (matched === 0) {
    throw new Error(`No ${method} ${path} request found in the collection — has it been renamed?`)
  }
  return [...keys].sort()
}

/**
 * A checked-in copy of the contract's field names, so a clone without the
 * collection still fails on a rename. The suites below are the authority — this
 * only exists because the collection is not committed.
 */
describe('authoring drafts keep the backend field names', () => {
  it('spells the room draft the way the API does', () => {
    expect(Object.keys(createEmptyRoomDraft()).sort()).toEqual([
      'narrationScript',
      'nextRoomId',
      'roomOverviewText',
      'storyOrder',
      'title',
    ])
  })

  it('spells the item draft the way the API does', () => {
    expect(Object.keys(createEmptyItemDraft()).sort()).toEqual([
      'detailText',
      'displayOrder',
      'imageUrl',
      'name',
      'shortDescription',
    ])
  })
})

describe.skipIf(!hasCollection)('room authoring matches the backend contract', () => {
  /** The server takes the museum from the bearer token and ignores a body museumId. */
  const serverOwnedKeys = ['museumId']

  it('sends exactly the fields POST /admin/rooms accepts', () => {
    const contractKeys = bodyKeysFor('POST', '/admin/rooms').filter(
      (key) => !serverOwnedKeys.includes(key),
    )
    expect(Object.keys(createEmptyRoomDraft()).sort()).toEqual(contractKeys)
  })

  it('uses roomOverviewText, not the old overviewText', () => {
    const draft = createEmptyRoomDraft()
    expect(bodyKeysFor('POST', '/admin/rooms')).toContain('roomOverviewText')
    expect(draft).toHaveProperty('roomOverviewText')
    expect(draft).not.toHaveProperty('overviewText')
  })
})

describe.skipIf(!hasCollection)('item authoring matches the backend contract', () => {
  /** roomId identifies the parent rather than being an editable field on the draft. */
  const parentKeys = ['roomId']

  it('sends exactly the fields POST /admin/items accepts', () => {
    const contractKeys = bodyKeysFor('POST', '/admin/items').filter(
      (key) => !parentKeys.includes(key),
    )
    expect(Object.keys(createEmptyItemDraft()).sort()).toEqual(contractKeys)
  })

  it('uses shortDescription and detailText, not the old names', () => {
    const draft = createEmptyItemDraft()
    const contractKeys = bodyKeysFor('POST', '/admin/items')

    expect(contractKeys).toContain('shortDescription')
    expect(contractKeys).toContain('detailText')
    expect(draft).toHaveProperty('shortDescription')
    expect(draft).toHaveProperty('detailText')
    expect(draft).not.toHaveProperty('visitorDescription')
    expect(draft).not.toHaveProperty('groundingDetail')
  })
})
