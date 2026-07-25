import { useEffect, useState, type ReactElement } from 'react'

import { Button, Field, IntegrationPendingPanel, Select, TextArea, TextInput, useToast } from '../../kit/index.ts'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type VoiceSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

const VOICE_OPTIONS = [
  { value: 'voice-ethiopic-clarity', label: 'Ethiopic Clarity' },
  { value: 'voice-heritage-guide', label: 'Heritage Guide' },
  { value: 'voice-museum-warm', label: 'Museum Warm' },
] as const

export function VoiceSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setVoice } = useTenantSettingsStore()
  const [draft, setDraft] = useState<VoiceSettingsForm>(value.voice)

  useEffect(() => {
    setDraft(value.voice)
  }, [value.voice])

  function save(): void {
    setVoice(draft)
    show({ tone: 'success', message: 'Voice settings saved.' })
  }

  return (
    <TenantSettingsLayout
      section="voice"
      title="Default voice"
      description="Set tenant defaults for generated narration voice characteristics."
    >
      <div className={styles.formGrid}>
        <Field id="settings-voice-default" label="Default voice">
          {(control) => (
            <Select
              {...control}
              value={draft.defaultVoiceId}
              onChange={(defaultVoiceId) => setDraft((current) => ({ ...current, defaultVoiceId }))}
              options={VOICE_OPTIONS}
            />
          )}
        </Field>

        <Field id="settings-voice-rate" label="Speaking rate">
          {(control) => (
            <TextInput
              {...control}
              value={draft.speakingRate}
              onChange={(speakingRate) => setDraft((current) => ({ ...current, speakingRate }))}
            />
          )}
        </Field>

        <Field id="settings-voice-pronunciation" label="Pronunciation hints">
          {(control) => (
            <TextArea
              {...control}
              rows={4}
              value={draft.pronunciationHints}
              onChange={(pronunciationHints) => setDraft((current) => ({ ...current, pronunciationHints }))}
            />
          )}
        </Field>

        <IntegrationPendingPanel
          dependency="Voice synthesis provider"
          body="Voice preview generation is disabled until provider credentials and stream endpoints are wired."
          stillUsable="Default voice choices and speaking-rate preferences are still editable."
          variant="inline"
        />

        <Button
          tone="secondary"
          disabled
          disabledReason="Integration pending: voice preview requires provider wiring."
        >
          Preview default voice
        </Button>
      </div>

      <div className={styles.rowActions}>
        <Button onClick={save}>Save voice settings</Button>
      </div>
    </TenantSettingsLayout>
  )
}
