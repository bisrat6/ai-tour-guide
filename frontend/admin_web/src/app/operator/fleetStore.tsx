import { createContext, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react'

import { FLEET_FIXTURES, type FleetHealth, type FleetMuseum, type FleetStatus } from './fleetFixtures.ts'

type OnboardInput = {
  readonly name: string
  readonly region: string
  readonly roomCount: number
}

export type FleetView = 'gallery' | 'table'

export type FleetUiState = {
  readonly view: FleetView
  readonly search: string
  readonly statusFilter: FleetStatus | 'all'
  readonly scrollY: number
}

type FleetStoreValue = {
  readonly museums: readonly FleetMuseum[]
  readonly fleetUi: FleetUiState
  readonly setFleetView: (view: FleetView) => void
  readonly setFleetSearch: (search: string) => void
  readonly setFleetStatusFilter: (statusFilter: FleetStatus | 'all') => void
  readonly setFleetScrollY: (scrollY: number) => void
  readonly onboardMuseum: (input: OnboardInput) => void
  readonly setMuseumStatus: (museumId: string, status: FleetStatus) => void
  readonly getMuseumById: (museumId: string) => FleetMuseum | undefined
}

const fleetStoreContext = createContext<FleetStoreValue | null>(null)

function toMuseumId(name: string): string {
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

export function FleetStoreProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const [museums, setMuseums] = useState<readonly FleetMuseum[]>(FLEET_FIXTURES)
  const [fleetUi, setFleetUi] = useState<FleetUiState>({
    view: 'gallery',
    search: '',
    statusFilter: 'all',
    scrollY: 0,
  })

  const value = useMemo<FleetStoreValue>(
    () => ({
      museums,
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
      onboardMuseum: ({ name, region, roomCount }) => {
        const trimmedName = name.trim()
        if (trimmedName.length === 0) return

        const idBase = toMuseumId(trimmedName)
        const existingIds = new Set(museums.map((museum) => museum.id))
        let museumId = idBase.length > 0 ? idBase : 'new-museum'
        let suffix = 1
        while (existingIds.has(museumId)) {
          suffix += 1
          museumId = `${idBase}-${suffix}`
        }

        const boundedRooms = Number.isFinite(roomCount) ? Math.max(1, Math.min(24, roomCount)) : 1
        const readiness = Array.from({ length: boundedRooms }).map((_, index) => ({
          id: `${museumId}-${index + 1}`,
          order: index + 1,
          marker: index === 0 ? 'ring' : 'dash',
        })) as FleetMuseum['readiness']

        const nextMuseum: FleetMuseum = {
          id: museumId,
          name: trimmedName,
          region: region.trim().length > 0 ? region.trim() : 'Unassigned',
          status: 'onboarding',
          roomCount: boundedRooms,
          readiness,
          spendMonthlyUsd: 0,
          health: 'watch',
          updatedAt: 'just now',
        }

        setMuseums((current) => [nextMuseum, ...current])
      },
      setMuseumStatus: (museumId, status) => {
        setMuseums((current) =>
          current.map((museum) =>
            museum.id === museumId
              ? {
                  ...museum,
                  status,
                  health: deriveHealth(status),
                  updatedAt: 'just now',
                }
              : museum,
          ),
        )
      },
      getMuseumById: (museumId) => museums.find((museum) => museum.id === museumId),
    }),
    [fleetUi, museums],
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
