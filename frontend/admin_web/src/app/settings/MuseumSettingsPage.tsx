import { useEffect, useState, type ReactElement } from 'react'

import { Button, Checkbox, Field, TextInput, useToast } from '../../kit/index.ts'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type MuseumSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

export function MuseumSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setMuseum } = useTenantSettingsStore()
  const [draft, setDraft] = useState<MuseumSettingsForm>(value.museum)

  useEffect(() => {
    setDraft(value.museum)
  }, [value.museum])

  function save(): void {
    setMuseum(draft)
    show({ tone: 'success', message: 'Museum settings saved.' })
  }

  return (
    <TenantSettingsLayout
      section="museum"
      title="Museum identity and activation"
      description="Museum-admin editable identity basics in tenant scope."
    >
      <div className={styles.formGrid}>
        <Field id="settings-museum-name" label="Museum name" required>
          {(control) => (
            <TextInput
              {...control}
              value={draft.museumName}
              onChange={(museumName) => setDraft((current) => ({ ...current, museumName }))}
            />
          )}
        </Field>

        <Field id="settings-museum-location" label="City and country" required>
          {(control) => (
            <TextInput
              {...control}
              value={draft.cityCountry}
              onChange={(cityCountry) => setDraft((current) => ({ ...current, cityCountry }))}
            />
          )}
        </Field>

        <Field id="settings-museum-slug" label="Public slug" hint="Used for tenant-facing links and previews.">
          {(control) => (
            <TextInput
              {...control}
              value={draft.publicSlug}
              onChange={(publicSlug) => setDraft((current) => ({ ...current, publicSlug }))}
            />
          )}
        </Field>

        <Checkbox
          id="settings-museum-active"
          checked={draft.isActive}
          onChange={(isActive) => setDraft((current) => ({ ...current, isActive }))}
          label="Museum is active"
        />
      </div>

      <div className={styles.rowActions}>
        <Button onClick={save}>Save museum settings</Button>
      </div>
    </TenantSettingsLayout>
  )
}
