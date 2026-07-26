import { useEffect, useState, type ReactElement } from 'react'

import { Button, Field, Select, StateBlock, TextArea, useToast } from '../../kit/index.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type GuideSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

const GUIDE_STYLE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'scholarly', label: 'Scholarly' },
] as const

export function GuideSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setGuide, status, loadError, isLive } = useTenantSettingsStore()
  const [draft, setDraft] = useState<GuideSettingsForm>(value.guide)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(value.guide)
  }, [value.guide])

  async function save(): Promise<void> {
    if (saving) return
    setSaving(true)
    try {
      const result = await setGuide(draft)
      if (!result.ok) {
        show({ tone: 'danger', message: result.message })
        return
      }
      show({ tone: 'success', message: 'Guide persona settings saved.' })
    } finally {
      setSaving(false)
    }
  }

  if (status !== 'ready') {
    return (
      <TenantSettingsLayout
        section="guide"
        title="AI guide persona"
        description="Configure tone and grounding policy for this museum's guide responses."
      >
        <StateBlock
          size="region"
          state={
            status === 'loading'
              ? { kind: 'loading', label: 'Loading guide settings' }
              : {
                  kind: 'failure',
                  title: 'Could not load these settings',
                  body: loadError ?? 'The server did not answer.',
                }
          }
        />
      </TenantSettingsLayout>
    )
  }

  return (
    <TenantSettingsLayout
      section="guide"
      title="AI guide persona"
      description="Configure tone and grounding policy for this museum's guide responses."
    >
      <div className={styles.formGrid}>
        <Field
          id="settings-guide-policy"
          label="Grounding policy"
          hint="Prepended to every visitor question as the model's system prompt."
        >
          {(control) => (
            <TextArea
              {...control}
              rows={7}
              value={draft.groundingPolicy}
              onChange={(groundingPolicy) => setDraft((current) => ({ ...current, groundingPolicy }))}
              maxLength={900}
              showCount
            />
          )}
        </Field>

        <Field id="settings-guide-name" label="Persona name">
          {(control) => (
            <TextArea
              {...control}
              rows={2}
              value={draft.personaName}
              onChange={(personaName) => setDraft((current) => ({ ...current, personaName }))}
              maxLength={120}
              showCount
            />
          )}
        </Field>

        <Field id="settings-guide-style" label="Style tone">
          {(control) => (
            <Select
              {...control}
              value={draft.styleTone}
              onChange={(styleTone) =>
                setDraft((current) => ({
                  ...current,
                  styleTone: styleTone as GuideSettingsForm['styleTone'],
                }))
              }
              options={GUIDE_STYLE_OPTIONS}
            />
          )}
        </Field>

        {isLive ? (
          <DemoDataNote>
            Only the grounding policy reaches the model. Persona name and style tone are kept in
            this browser — fold either into the policy text to make it take effect.
          </DemoDataNote>
        ) : null}
      </div>

      <div className={styles.rowActions}>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save guide settings'}
        </Button>
      </div>
    </TenantSettingsLayout>
  )
}
