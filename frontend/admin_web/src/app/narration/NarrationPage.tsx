import { useEffect, useMemo, useState, type ReactElement } from 'react'

import {
  Button,
  Field,
  IntegrationPendingPanel,
  Panel,
  Select,
  StatusBadge,
  TextArea,
  useToast,
} from '../../kit/index.ts'
import { toRoomDraft, useAuthoringStore } from '../rooms/authoringStore.tsx'
import {
  DEFAULT_ROOM_VOICE_BY_ID,
  NARRATION_GROUPS,
  VOICE_OPTIONS,
  groupFromNarrationStatus,
  labelFromNarrationStatus,
} from './narrationFixtures.ts'
import styles from './NarrationPage.module.css'

const STORAGE_KEY = 'adwa.admin.phase6.narration.voiceByRoom'

type VoiceByRoom = Record<string, string>

function readVoiceState(): VoiceByRoom {
  if (typeof window === 'undefined') return { ...DEFAULT_ROOM_VOICE_BY_ID }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return { ...DEFAULT_ROOM_VOICE_BY_ID }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next: VoiceByRoom = { ...DEFAULT_ROOM_VOICE_BY_ID }
    for (const [roomId, voiceId] of Object.entries(parsed)) {
      if (typeof voiceId === 'string') next[roomId] = voiceId
    }
    return next
  } catch {
    return { ...DEFAULT_ROOM_VOICE_BY_ID }
  }
}

function writeVoiceState(state: VoiceByRoom): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function voiceLabel(voiceId: string): string {
  return VOICE_OPTIONS.find((voice) => voice.value === voiceId)?.label ?? 'Unassigned voice'
}

export function NarrationPage(): ReactElement {
  const { show } = useToast()
  const { rooms, updateRoom } = useAuthoringStore()
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id ?? '')
  const [draftScript, setDraftScript] = useState<string>('')
  const [voiceByRoom, setVoiceByRoom] = useState<VoiceByRoom>(readVoiceState)

  useEffect(() => {
    writeVoiceState(voiceByRoom)
  }, [voiceByRoom])

  useEffect(() => {
    if (rooms.length === 0) {
      setSelectedRoomId('')
      return
    }
    const selectedStillExists = rooms.some((room) => room.id === selectedRoomId)
    if (!selectedStillExists) setSelectedRoomId(rooms[0].id)
  }, [rooms, selectedRoomId])

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId)

  useEffect(() => {
    const room = rooms.find((candidate) => candidate.id === selectedRoomId)
    if (room === undefined) return
    setDraftScript(room.narrationScript)
  }, [rooms, selectedRoomId])

  const groupedRooms = useMemo(() => {
    return NARRATION_GROUPS.map((group) => ({
      ...group,
      rooms: rooms.filter((room) => groupFromNarrationStatus(room.narrationStatus) === group.id),
    }))
  }, [rooms])

  function handleSaveScript(): void {
    if (selectedRoom === undefined) return
    const nextDraft = { ...toRoomDraft(selectedRoom), narrationScript: draftScript }
    const result = updateRoom(selectedRoom.id, nextDraft)
    if (!result.ok) return
    show({ tone: 'success', message: `Narration script saved for ${selectedRoom.title}.` })
  }

  function handleRegenerate(): void {
    if (selectedRoom === undefined) return
    show({
      tone: 'neutral',
      message: `Fixture-only action: regeneration requested for ${selectedRoom.title}.`,
    })
  }

  function setVoice(roomId: string, voiceId: string): void {
    setVoiceByRoom((current) => ({ ...current, [roomId]: voiceId }))
  }

  const selectedVoiceId =
    selectedRoom === undefined
      ? VOICE_OPTIONS[0].value
      : voiceByRoom[selectedRoom.id] ?? VOICE_OPTIONS[0].value

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Narration</h1>
          <p className={`text-body ${styles.muted}`}>
            Group rooms by audio readiness, update script and voice, and queue fixture regeneration.
          </p>
        </div>
      </header>

      <section className={styles.layout}>
        <Panel title="Rooms by audio state">
          <div className={styles.groupStack}>
            {groupedRooms.map((group) => (
              <section key={group.id} className={styles.groupSection} aria-label={group.title}>
                <div className={styles.groupHeader}>
                  <StatusBadge tone={group.tone} label={`${group.title} (${group.rooms.length})`} />
                  <p className={`text-caption ${styles.muted}`}>{group.description}</p>
                </div>
                {group.rooms.length === 0 ? (
                  <p className={`text-caption ${styles.muted}`}>No rooms in this state.</p>
                ) : (
                  <ul className={styles.roomList}>
                    {group.rooms.map((room) => (
                      <li key={room.id}>
                        <button
                          type="button"
                          className={`${styles.roomButton} ${
                            room.id === selectedRoomId ? styles.roomButtonActive : ''
                          }`}
                          onClick={() => setSelectedRoomId(room.id)}
                          aria-pressed={room.id === selectedRoomId}
                        >
                          <div>
                            <p className="text-body">
                              {room.storyOrder}. {room.title}
                            </p>
                            <p className={`text-caption ${styles.muted}`}>
                              Voice: {voiceLabel(voiceByRoom[room.id] ?? VOICE_OPTIONS[0].value)}
                            </p>
                          </div>
                          <StatusBadge tone={group.tone} label={labelFromNarrationStatus(room.narrationStatus)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="Narration workspace">
          {selectedRoom === undefined ? (
            <p className={`text-body ${styles.muted}`}>No room selected.</p>
          ) : (
            <div className={styles.workspace}>
              <div className={styles.metaGrid}>
                <div>
                  <p className="text-subtitle">
                    {selectedRoom.storyOrder}. {selectedRoom.title}
                  </p>
                  <p className={`text-caption ${styles.muted}`}>
                    Status grouped as {groupFromNarrationStatus(selectedRoom.narrationStatus).replace('_', ' ')}.
                  </p>
                </div>
                <StatusBadge
                  tone={
                    NARRATION_GROUPS.find(
                      (group) => group.id === groupFromNarrationStatus(selectedRoom.narrationStatus),
                    )?.tone ?? 'neutral'
                  }
                  label={labelFromNarrationStatus(selectedRoom.narrationStatus)}
                />
              </div>

              <Field id={`narration-script-${selectedRoom.id}`} label="Script">
                {(control) => (
                  <TextArea
                    {...control}
                    value={draftScript}
                    onChange={setDraftScript}
                    rows={10}
                    maxLength={3000}
                    showCount
                  />
                )}
              </Field>

              <Field id={`narration-voice-${selectedRoom.id}`} label="Voice">
                {(control) => (
                  <Select
                    {...control}
                    value={selectedVoiceId}
                    onChange={(nextValue) => setVoice(selectedRoom.id, nextValue)}
                    options={VOICE_OPTIONS}
                  />
                )}
              </Field>

              <IntegrationPendingPanel
                dependency="Voice playback provider"
                body="Playback controls are intentionally disabled until provider wiring exposes real audio files and stream state."
                stillUsable="Script edits, voice selection, and regenerate requests remain available in fixtures."
                variant="inline"
              />

              <div className={styles.playbackControls}>
                <Button
                  tone="secondary"
                  disabled
                  disabledReason="Integration pending: provider playback state is not connected yet."
                >
                  Play preview
                </Button>
                <Button
                  tone="ghost"
                  disabled
                  disabledReason="Integration pending: provider playback state is not connected yet."
                >
                  Pause
                </Button>
              </div>

              <div className={styles.workspaceActions}>
                <Button tone="secondary" onClick={handleRegenerate}>
                  Regenerate audio
                </Button>
                <Button onClick={handleSaveScript}>Save narration script</Button>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </div>
  )
}
