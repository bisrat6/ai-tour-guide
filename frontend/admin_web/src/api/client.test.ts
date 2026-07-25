import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteRoom, listRooms, updateItem } from './adminApi.ts'
import { apiRequest, setAuthToken } from './client.ts'
import { ApiError, isApiError, isSessionExpired } from './errors.ts'

type FetchMock = ReturnType<typeof vi.fn>

let fetchMock: FetchMock

function respond(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key] ?? null },
    json: async () => body,
  } as unknown as Response
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, init }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setAuthToken(null)
})

afterEach(() => {
  setAuthToken(null)
})

describe('request building', () => {
  it('targets the configured base URL', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    await listRooms()
    expect(lastCall().url).toBe('https://api.test/admin/rooms')
  })

  it('sends the bearer token once one is set', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    setAuthToken('token-123')
    await listRooms()

    const headers = lastCall().init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })

  it('omits the Authorization header when signed out', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    await listRooms()

    const headers = lastCall().init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('never sends cookies, since scope comes from the bearer token', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    await listRooms()
    expect(lastCall().init.credentials).toBe('omit')
  })

  it('drops undefined query parameters instead of sending "undefined"', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    await listRooms({ museumId: null, limit: 50 })
    expect(lastCall().url).toBe('https://api.test/admin/rooms?limit=50')
  })

  it('passes museumId through for a system admin', async () => {
    fetchMock.mockResolvedValue(respond(200, { data: [] }))
    await listRooms({ museumId: 'museum-1' })
    expect(lastCall().url).toBe('https://api.test/admin/rooms?museumId=museum-1')
  })

  it('sends a null imageUrl so an image can be cleared', async () => {
    fetchMock.mockResolvedValue(respond(200, {}))
    await updateItem('item-1', { imageUrl: null })
    expect(JSON.parse(String(lastCall().init.body))).toEqual({ imageUrl: null })
  })
})

/**
 * The backend once parsed force with z.coerce.boolean(), where Boolean('false')
 * is true — so a UI sending a real boolean deleted referenced rooms anyway. It
 * is now a strict 'true' | 'false' enum, and these pin the client to it.
 */
describe('room delete force flag', () => {
  it('sends the literal string "false" by default', async () => {
    fetchMock.mockResolvedValue(respond(204, null))
    await deleteRoom('room-1')
    expect(lastCall().url).toBe('https://api.test/admin/rooms/room-1?force=false')
  })

  it('sends the literal string "true" when forced', async () => {
    fetchMock.mockResolvedValue(respond(204, null))
    await deleteRoom('room-1', { force: true })
    expect(lastCall().url).toBe('https://api.test/admin/rooms/room-1?force=true')
  })

  it('resolves without a body on 204', async () => {
    fetchMock.mockResolvedValue(respond(204, null))
    await expect(deleteRoom('room-1', { force: true })).resolves.toBeUndefined()
  })
})

describe('error handling', () => {
  it('parses the error envelope into a typed ApiError', async () => {
    fetchMock.mockResolvedValue(
      respond(
        403,
        {
          error: {
            message: 'Museum A may not read museum B.',
            code: 'CROSS_TENANT_ACCESS',
            requestId: 'req-abc',
          },
        },
        { 'X-Request-Id': 'req-abc' },
      ),
    )

    const error = await listRooms().catch((cause: unknown) => cause)

    expect(isApiError(error)).toBe(true)
    const apiError = error as ApiError
    expect(apiError.code).toBe('CROSS_TENANT_ACCESS')
    expect(apiError.status).toBe(403)
    expect(apiError.requestId).toBe('req-abc')
    expect(apiError.message).toBe('Museum A may not read museum B.')
  })

  it('keeps a role refusal distinct from a tenant boundary', async () => {
    fetchMock.mockResolvedValue(
      respond(403, { error: { message: 'Not allowed.', code: 'FORBIDDEN', requestId: 'r1' } }),
    )

    const error = (await listRooms().catch((cause: unknown) => cause)) as ApiError
    expect(error.code).toBe('FORBIDDEN')
    expect(error.code).not.toBe('CROSS_TENANT_ACCESS')
  })

  it('surfaces field details so a message can land on the right input', async () => {
    fetchMock.mockResolvedValue(
      respond(400, {
        error: {
          message: 'Validation failed.',
          code: 'VALIDATION_ERROR',
          requestId: 'r2',
          details: [{ field: 'slug', message: 'Slug must be lowercase.' }],
        },
      }),
    )

    const error = (await listRooms().catch((cause: unknown) => cause)) as ApiError
    expect(error.fieldError('slug')).toBe('Slug must be lowercase.')
    expect(error.fieldError('name')).toBeUndefined()
  })

  it('falls back to the status code when there is no envelope', async () => {
    fetchMock.mockResolvedValue(respond(409, null, { 'X-Request-Id': 'r3' }))

    const error = (await listRooms().catch((cause: unknown) => cause)) as ApiError
    expect(error.code).toBe('CONFLICT')
    expect(error.requestId).toBe('r3')
  })

  it('reports an unreachable server as a network error rather than throwing raw', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = (await listRooms().catch((cause: unknown) => cause)) as ApiError
    expect(isApiError(error)).toBe(true)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.status).toBe(0)
  })

  it('recognises an expired session so the app can return to the door', async () => {
    fetchMock.mockResolvedValue(
      respond(401, { error: { message: 'Token expired.', code: 'UNAUTHENTICATED', requestId: 'r4' } }),
    )

    const error = await apiRequest('/admin/rooms').catch((cause: unknown) => cause)
    expect(isSessionExpired(error)).toBe(true)
  })
})
