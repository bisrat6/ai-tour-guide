/**
 * Tenant settings, part server and part local.
 *
 * Only four fields on a museum can actually be written: `status`,
 * `ticketValidationUrl`, `systemPrompt`, and `defaultVoiceId`. `name` and
 * `slug` are read-only after creation — the PATCH schema does not declare them.
 * Everything else on these four forms has no column behind it at all.
 *
 * Rather than quietly drop the rest, the unbacked fields keep their existing
 * localStorage home and the pages label them. SERVER_BACKED below is the whole
 * of what leaves the browser.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getMuseum, updateMuseum } from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import type { ApiMuseum } from '../../api/types.ts'
import { useActiveMuseumId } from '../auth/useActiveMuseumId.ts'
import { useAuth } from '../auth/sessionContext.ts'

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
  /** The one piece of gate configuration the server actually holds. */
  ticketValidationUrl: string
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

/**
 * Which inputs reach the server. Anything absent is browser-local, and the
 * pages read this to decide what to label.
 */
export const SERVER_BACKED = {
  museum: { museumName: 'read-only', publicSlug: 'read-only', isActive: 'system-admin' },
  gate: { ticketValidationUrl: 'editable' },
  guide: { groundingPolicy: 'editable' },
  voice: { defaultVoiceId: 'editable' },
} as const

export type SaveResult = { ok: true } | { ok: false; message: string }

export type SettingsStatus = 'loading' | 'ready' | 'error'

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
      ticketValidationUrl: '',
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

/** Overlays what the server knows onto whatever the browser was holding. */
function applyMuseum(bundle: TenantSettingsBundle, museum: ApiMuseum): TenantSettingsBundle {
  return {
    ...bundle,
    museum: {
      ...bundle.museum,
      museumName: museum.name,
      publicSlug: museum.slug,
      isActive: museum.status === 'ACTIVE',
    },
    gate: { ...bundle.gate, ticketValidationUrl: museum.ticketValidationUrl ?? '' },
    guide: { ...bundle.guide, groundingPolicy: museum.systemPrompt ?? '' },
    voice: { ...bundle.voice, defaultVoiceId: museum.defaultVoiceId ?? '' },
  }
}

function failureMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

export type TenantSettingsStore = {
  readonly museumId: string
  readonly value: TenantSettingsBundle
  readonly status: SettingsStatus
  readonly loadError: string | null
  /** False when running on browser-local defaults because no API is configured. */
  readonly isLive: boolean
  /** Museum status is a system-admin decision, so the control is shown disabled. */
  readonly canChangeStatus: boolean
  readonly setMuseum: (next: MuseumSettingsForm) => Promise<SaveResult>
  readonly setGate: (next: GateSettingsForm) => Promise<SaveResult>
  readonly setGuide: (next: GuideSettingsForm) => Promise<SaveResult>
  readonly setVoice: (next: VoiceSettingsForm) => Promise<SaveResult>
}

export function useTenantSettingsStore(): TenantSettingsStore {
  const activeMuseumId = useActiveMuseumId()
  const { session } = useAuth()
  const museumId = activeMuseumId ?? DEFAULT_MUSEUM_ID
  const live = isLiveApi && activeMuseumId !== null

  const [byMuseum, setByMuseum] = useState<Record<string, TenantSettingsBundle>>(() => {
    const stored = readStoredByMuseum()
    return { ...stored, [museumId]: stored[museumId] ?? createDefaultBundle() }
  })
  const [status, setStatus] = useState<SettingsStatus>(live ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    writeStoredByMuseum(byMuseum)
  }, [byMuseum])

  useEffect(() => {
    setByMuseum((current) => ({
      ...current,
      [museumId]: current[museumId] ?? createDefaultBundle(),
    }))
  }, [museumId])

  useEffect(() => {
    if (!live) {
      setStatus('ready')
      setLoadError(null)
      return
    }

    let current = true
    setStatus('loading')
    setLoadError(null)

    getMuseum(museumId)
      .then((museum) => {
        if (!current) return
        setByMuseum((state) => ({
          ...state,
          [museumId]: applyMuseum(state[museumId] ?? createDefaultBundle(), museum),
        }))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setStatus('error')
        setLoadError(failureMessage(error, 'Could not load this museum’s settings.'))
      })

    return () => {
      current = false
    }
  }, [live, museumId])

  const value = useMemo(
    () => byMuseum[museumId] ?? createDefaultBundle(),
    [byMuseum, museumId],
  )

  /**
   * Local first, then the server. The order matters: a refused write must not
   * leave the form showing a value the server never accepted, so a failure
   * rolls the section back to what was there before.
   */
  const persist = useCallback(
    async <Section extends keyof TenantSettingsBundle>(
      section: Section,
      next: TenantSettingsBundle[Section],
      patch: Parameters<typeof updateMuseum>[1],
      fallbackMessage: string,
    ): Promise<SaveResult> => {
      const previous = byMuseum[museumId] ?? createDefaultBundle()
      setByMuseum((state) => ({
        ...state,
        [museumId]: { ...(state[museumId] ?? createDefaultBundle()), [section]: next },
      }))

      if (!live || Object.keys(patch).length === 0) return { ok: true }

      try {
        const museum = await updateMuseum(museumId, patch)
        setByMuseum((state) => ({
          ...state,
          [museumId]: applyMuseum(state[museumId] ?? createDefaultBundle(), museum),
        }))
        return { ok: true }
      } catch (error) {
        setByMuseum((state) => ({ ...state, [museumId]: previous }))
        return { ok: false, message: failureMessage(error, fallbackMessage) }
      }
    },
    [byMuseum, live, museumId],
  )

  const canChangeStatus = session?.role === 'SYSTEM_ADMIN'

  return {
    museumId,
    value,
    status,
    loadError,
    isLive: live,
    canChangeStatus: canChangeStatus === true,
    setMuseum: (next) =>
      persist(
        'museum',
        next,
        // Name and slug have no PATCH, and status 403s for a museum admin.
        canChangeStatus === true ? { status: next.isActive ? 'ACTIVE' : 'SUSPENDED' } : {},
        'Could not save the museum settings.',
      ),
    setGate: (next) =>
      persist(
        'gate',
        next,
        {
          ticketValidationUrl:
            next.ticketValidationUrl.trim().length > 0 ? next.ticketValidationUrl.trim() : null,
        },
        'Could not save the gate settings.',
      ),
    setGuide: (next) =>
      persist(
        'guide',
        next,
        {
          systemPrompt:
            next.groundingPolicy.trim().length > 0 ? next.groundingPolicy.trim() : null,
        },
        'Could not save the guide settings.',
      ),
    setVoice: (next) =>
      persist(
        'voice',
        next,
        {
          defaultVoiceId:
            next.defaultVoiceId.trim().length > 0 ? next.defaultVoiceId.trim() : null,
        },
        'Could not save the voice settings.',
      ),
  }
}
