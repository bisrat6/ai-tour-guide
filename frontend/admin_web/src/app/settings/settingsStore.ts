import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

export type MuseumSettingsForm = {
  museumName: string
  cityCountry: string
  publicSlug: string
  isActive: boolean
}

export type GateSettingsForm = {
  gateMode: 'ticket_code' | 'staff_assisted'
  allowedTicketPrefix: string
  graceWindowMinutes: string
}

export type GuideSettingsForm = {
  personaName: string
  styleTone: 'formal' | 'conversational' | 'scholarly'
  groundingPolicy: string
}

export type VoiceSettingsForm = {
  defaultVoiceId: string
  speakingRate: string
  pronunciationHints: string
}

export type TenantSettingsBundle = {
  museum: MuseumSettingsForm
  gate: GateSettingsForm
  guide: GuideSettingsForm
  voice: VoiceSettingsForm
}

const STORAGE_KEY = 'adwa.admin.phase6.settings.byMuseum'
const DEFAULT_MUSEUM_ID = 'museum-adwa'

function createDefaultBundle(): TenantSettingsBundle {
  return {
    museum: {
      museumName: 'Adwa Memorial Museum',
      cityCountry: 'Adwa, Ethiopia',
      publicSlug: 'adwa-memorial',
      isActive: true,
    },
    gate: {
      gateMode: 'ticket_code',
      allowedTicketPrefix: 'ADWA-',
      graceWindowMinutes: '30',
    },
    guide: {
      personaName: 'Adwa Historical Guide',
      styleTone: 'scholarly',
      groundingPolicy:
        'Prioritize room-approved grounding text and item references. Explicitly state uncertainty when citation support is missing.',
    },
    voice: {
      defaultVoiceId: 'voice-ethiopic-clarity',
      speakingRate: '1.0',
      pronunciationHints: 'Menelik II; Ras Alula; Tigray',
    },
  }
}

function readStoredByMuseum(): Record<string, TenantSettingsBundle> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<TenantSettingsBundle>>
    const next: Record<string, TenantSettingsBundle> = {}
    for (const [museumId, partial] of Object.entries(parsed)) {
      const defaults = createDefaultBundle()
      next[museumId] = {
        museum: { ...defaults.museum, ...(partial.museum ?? {}) },
        gate: { ...defaults.gate, ...(partial.gate ?? {}) },
        guide: { ...defaults.guide, ...(partial.guide ?? {}) },
        voice: { ...defaults.voice, ...(partial.voice ?? {}) },
      }
    }
    return next
  } catch {
    return {}
  }
}

function writeStoredByMuseum(state: Record<string, TenantSettingsBundle>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useTenantSettingsStore(): {
  readonly museumId: string
  readonly value: TenantSettingsBundle
  readonly setMuseum: (next: MuseumSettingsForm) => void
  readonly setGate: (next: GateSettingsForm) => void
  readonly setGuide: (next: GuideSettingsForm) => void
  readonly setVoice: (next: VoiceSettingsForm) => void
} {
  const params = useParams()
  const museumId = params.museumId ?? DEFAULT_MUSEUM_ID
  const [byMuseum, setByMuseum] = useState<Record<string, TenantSettingsBundle>>(() => {
    const stored = readStoredByMuseum()
    return {
      ...stored,
      [museumId]: stored[museumId] ?? createDefaultBundle(),
    }
  })

  useEffect(() => {
    writeStoredByMuseum(byMuseum)
  }, [byMuseum])

  useEffect(() => {
    setByMuseum((current) => ({
      ...current,
      [museumId]: current[museumId] ?? createDefaultBundle(),
    }))
  }, [museumId])

  const value = useMemo(() => byMuseum[museumId] ?? createDefaultBundle(), [byMuseum, museumId])

  return {
    museumId,
    value,
    setMuseum: (next) =>
      setByMuseum((current) => ({
        ...current,
        [museumId]: { ...(current[museumId] ?? createDefaultBundle()), museum: next },
      })),
    setGate: (next) =>
      setByMuseum((current) => ({
        ...current,
        [museumId]: { ...(current[museumId] ?? createDefaultBundle()), gate: next },
      })),
    setGuide: (next) =>
      setByMuseum((current) => ({
        ...current,
        [museumId]: { ...(current[museumId] ?? createDefaultBundle()), guide: next },
      })),
    setVoice: (next) =>
      setByMuseum((current) => ({
        ...current,
        [museumId]: { ...(current[museumId] ?? createDefaultBundle()), voice: next },
      })),
  }
}
