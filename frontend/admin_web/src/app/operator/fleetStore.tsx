/**
 * The operator's list of museums.
 *
 * Against a live API the roster, its statuses, and its room counts are real:
 * `GET /admin/museums` for the list and one `GET /admin/rooms` per museum for
 * the readiness spine, whose segments read from whether narration audio exists.
 * Suspending, reinstating, and onboarding all go to the server.
 *
 * Spend and health do not exist on the backend in any form. They stay as
 * fixtures and every surface that shows them says so.
 */

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
import type { ApiMuseum, ApiRoom } from '../../api/types.ts'
import {
  FLEET_FIXTURES,
  type FleetHealth,
  type FleetMuseum,
  type FleetStatus,
} from './fleetFixtures.ts'

/**
 * Creating a museum creates its first administrator in the same transaction, so
 * onboarding cannot be reduced to a name.
 */
export type OnboardInput = {
  readonly name: string
  readonly slug: string
  readonly adminEmail: string
  readonly adminPassword: string
}

export type FleetView = 'gallery' | 'table'

export type LoadStatus = 'loading' | 'ready' | 'error'

export type FleetWriteResult = { ok: true } | { ok: false; message: string }
export type OnboardResult = { ok: true; museumId: string } | { ok: false; message: string }

export type FleetUiState = {
  readonly view: FleetView
  readonly search: string
  readonly statusFilter: FleetStatus | 'all'
  readonly scrollY: number
}

type FleetStoreValue = {
  readonly museums: readonly FleetMuseum[]
  /** False when running on fixtures because no API is configured. */
  readonly isLive: boolean
  readonly status: LoadStatus
  readonly loadError: string | null
  readonly reload: () => void
  readonly fleetUi: FleetUiState
  readonly setFleetView: (view: FleetView) => void
  readonly setFleetSearch: (search: string) => void
  readonly setFleetStatusFilter: (statusFilter: FleetStatus | 'all') => void
  readonly setFleetScrollY: (scrollY: number) => void
  readonly onboardMuseum: (input: OnboardInput) => Promise<OnboardResult>
  readonly setMuseumStatus: (museumId: string, status: FleetStatus) => Promise<FleetWriteResult>
  readonly getMuseumById: (museumId: string) => FleetMuseum | undefined
}

const fleetStoreContext = createContext<FleetStoreValue | null>(null)

/** One request is enough for any fleet an operator could work through by hand. */
const PAGE_SIZE = 200

const UNEXPECTED = 'Something went wrong. Try again.'

function messageFor(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

function toFleetId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function deriveHealth(status: FleetStatus): FleetHealth {
  if (status === 'suspended') return 'critical'
  if (status === 'onboarding') return 'watch'
  return 'healthy'
}

/**
 * The backend has two statuses, not three. `onboarding` is an editorial state
 * with nothing behind it, so a live museum is only ever active or suspended.
 */
function toFleetStatus(status: ApiMuseum['status']): FleetStatus {
  return status === 'SUSPENDED' ? 'suspended' : 'active'
}

/**
 * A room shows as ready once its narration audio exists. That is the only
 * per-room readiness the backend records, and it is the thing an operator is
 * actually waiting on before a museum can open.
 */
function readinessFor(rooms: readonly ApiRoom[]): FleetMuseum['readiness'] {
  return [...rooms]
    .sort((left, right) => left.storyOrder - right.storyOrder)
    .map((room, index) => ({
      id: room.id,
      order: index + 1,
      marker: room.roomAudioUrl === null ? ('dash' as const) : ('dot' as const),
    }))
}

async function fetchMuseumRooms(museumId: string): Promise<readonly ApiRoom[]> {
  const rooms: ApiRoom[] = []
  let cursor: string | undefined

  do {
    const page = await api.listRooms({
      museumId,
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    })
    rooms.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  return rooms
}

async function fetchFleet(): Promise<readonly FleetMuseum[]> {
  const museums: ApiMuseum[] = []
  let cursor: string | undefined

  do {
    const page = await api.listMuseums({
      limit: PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    })
    museums.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)

  const roomsByMuseum = await Promise.all(museums.map((museum) => fetchMuseumRooms(museum.id)))

  return museums.map((museum, index) => {
    const rooms = roomsByMuseum[index] ?? []
    return {
      id: museum.id,
      name: museum.name,
      slug: museum.slug,
      status: toFleetStatus(museum.status),
      roomCount: rooms.length,
      readiness: readinessFor(rooms),
      spendMonthlyUsd: 0,
      health: deriveHealth(toFleetStatus(museum.status)),
      updatedAt: museum.updatedAt,
    }
  })
}

export function FleetStoreProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const live = isLiveApi

  const [museums, setMuseums] = useState<readonly FleetMuseum[]>(live ? [] : FLEET_FIXTURES)
  const [status, setStatus] = useState<LoadStatus>(live ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [fleetUi, setFleetUi] = useState<FleetUiState>({
    view: 'gallery',
    search: '',
    statusFilter: 'all',
    scrollY: 0,
  })

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  /** Guards a slow response from an earlier load overwriting a newer one. */
  const requestRef = useRef(0)

  useEffect(() => {
    if (!live) return

    const request = requestRef.current + 1
    requestRef.current = request
    setStatus('loading')
    setLoadError(null)

    fetchFleet()
      .then((loaded) => {
        if (requestRef.current !== request) return
        setMuseums(loaded)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (requestRef.current !== request) return
        setMuseums([])
        setStatus('error')
        setLoadError(messageFor(error, 'Could not load the fleet.'))
      })
  }, [live, reloadToken])

  const value = useMemo<FleetStoreValue>(
    () => ({
      museums,
      isLive: live,
      status,
      loadError,
      reload,
      fleetUi,
      setFleetView: (view) => {
        setFleetUi((current) => (current.view === view ? current : { ...current, view }))
      },
      setFleetSearch: (search) => {
        setFleetUi((current) => (current.search === search ? current : { ...current, search }))
      },
      setFleetStatusFilter: (statusFilter) => {
        setFleetUi((current) =>
          current.statusFilter === statusFilter ? current : { ...current, statusFilter },
        )
      },
      setFleetScrollY: (scrollY) => {
        setFleetUi((current) => {
          const boundedScroll = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0
          return current.scrollY === boundedScroll ? current : { ...current, scrollY: boundedScroll }
        })
      },
      onboardMuseum: async ({ name, slug, adminEmail, adminPassword }) => {
        const trimmedName = name.trim()
        if (trimmedName.length === 0) return { ok: false, message: 'Enter a museum name.' }

        if (!live) {
          const idBase = toFleetId(trimmedName)
          const existingIds = new Set(museums.map((museum) => museum.id))
          let museumId = idBase.length > 0 ? idBase : 'new-museum'
          let suffix = 1
          while (existingIds.has(museumId)) {
            suffix += 1
            museumId = `${idBase}-${suffix}`
          }

          setMuseums((current) => [
            {
              id: museumId,
              name: trimmedName,
              slug: slug.trim().length > 0 ? slug.trim() : museumId,
              status: 'onboarding',
              roomCount: 0,
              readiness: [],
              spendMonthlyUsd: 0,
              health: 'watch',
              updatedAt: new Date().toISOString(),
            },
            ...current,
          ])
          return { ok: true, museumId }
        }

        try {
          const created = await api.createMuseum({
            name: trimmedName,
            slug: slug.trim(),
            adminEmail: adminEmail.trim(),
            adminPassword,
          })
          setMuseums((current) => [
            {
              id: created.museum.id,
              name: created.museum.name,
              slug: created.museum.slug,
              status: toFleetStatus(created.museum.status),
              roomCount: 0,
              readiness: [],
              spendMonthlyUsd: 0,
              health: 'watch',
              updatedAt: created.museum.updatedAt,
            },
            ...current,
          ])
          return { ok: true, museumId: created.museum.id }
        } catch (error) {
          return { ok: false, message: messageFor(error, UNEXPECTED) }
        }
      },
      setMuseumStatus: async (museumId, nextStatus) => {
        /**
         * `onboarding` cannot be sent: it is not one of the backend's two
         * statuses. Nothing in the UI asks for it, and this keeps that true.
         */
        if (live && nextStatus !== 'onboarding') {
          try {
            await api.updateMuseum(museumId, {
              status: nextStatus === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
            })
          } catch (error) {
            return { ok: false, message: messageFor(error, UNEXPECTED) }
          }
        }

        setMuseums((current) =>
          current.map((museum) =>
            museum.id === museumId
              ? {
                  ...museum,
                  status: nextStatus,
                  health: deriveHealth(nextStatus),
                  updatedAt: new Date().toISOString(),
                }
              : museum,
          ),
        )
        return { ok: true }
      },
      getMuseumById: (museumId) => museums.find((museum) => museum.id === museumId),
    }),
    [fleetUi, live, loadError, museums, reload, status],
  )

  return <fleetStoreContext.Provider value={value}>{children}</fleetStoreContext.Provider>
}

export function useFleetStore(): FleetStoreValue {
  const context = useContext(fleetStoreContext)
  if (context === null) {
    throw new Error('Fleet store is unavailable.')
  }
  return context
}
