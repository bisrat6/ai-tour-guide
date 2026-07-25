import { useEffect, useState, type ReactElement } from 'react'

import { Button, Field, Select, TextArea, useToast } from '../../kit/index.ts'
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
  const { value, setGuide } = useTenantSettingsStore()
  const [draft, setDraft] = useState<GuideSettingsForm>(value.guide)

  useEffect(() => {
    setDraft(value.guide)
  }, [value.guide])

  function save(): void {
    setGuide(draft)
    show({ tone: 'success', message: 'Guide persona settings saved.' })
  }

  return (
    <TenantSettingsLayout
      section="guide"
      title="AI guide persona"
      description="Configure tone and grounding policy for this museum's guide responses."
    >
      <div className={styles.formGrid}>
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
                setDraft((current) => ({ ...current, styleTone: styleTone as GuideSettingsForm['styleTone'] }))
              }
              options={GUIDE_STYLE_OPTIONS}
            />
          )}
        </Field>

        <Field id="settings-guide-policy" label="Grounding policy">
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
      </div>

      <div className={styles.rowActions}>
        <Button onClick={save}>Save guide settings</Button>
      </div>
    </TenantSettingsLayout>
  )
}
