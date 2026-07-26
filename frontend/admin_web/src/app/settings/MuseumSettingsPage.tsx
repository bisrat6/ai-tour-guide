import { useEffect, useState, type ReactElement } from 'react'

import { Button, Checkbox, Field, StateBlock, TextInput, useToast } from '../../kit/index.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type MuseumSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

export function MuseumSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setMuseum, status, loadError, isLive, canChangeStatus } = useTenantSettingsStore()
  const [draft, setDraft] = useState<MuseumSettingsForm>(value.museum)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(value.museum)
  }, [value.museum])

  async function save(): Promise<void> {
    if (saving) return
    setSaving(true)
    try {
      const result = await setMuseum(draft)
      if (!result.ok) {
        show({ tone: 'danger', message: result.message })
        return
      }
      show({ tone: 'success', message: 'Museum settings saved.' })
    } finally {
      setSaving(false)
    }
  }

  if (status !== 'ready') {
    return (
      <TenantSettingsLayout
        section="museum"
        title="Museum identity and activation"
        description="Museum-admin editable identity basics in tenant scope."
      >
        <StateBlock
          size="region"
          state={
            status === 'loading'
              ? { kind: 'loading', label: 'Loading museum settings' }
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
      section="museum"
      title="Museum identity and activation"
      description="Museum-admin editable identity basics in tenant scope."
    >
      <div className={styles.formGrid}>
        <Field
          id="settings-museum-name"
          label="Museum name"
          readOnly={isLive}
          {...(isLive
            ? { hint: 'Set when the museum was created. There is no route to rename it.' }
            : {})}
        >
          {(control) => (
            <TextInput
              {...control}
              value={draft.museumName}
              onChange={(museumName) => setDraft((current) => ({ ...current, museumName }))}
            />
          )}
        </Field>

        <Field
          id="settings-museum-location"
          label="City and country"
          hint="Kept in this browser. The museum record has no location field."
        >
          {(control) => (
            <TextInput
              {...control}
              value={draft.cityCountry}
              onChange={(cityCountry) => setDraft((current) => ({ ...current, cityCountry }))}
            />
          )}
        </Field>

        <Field
          id="settings-museum-slug"
          label="Public slug"
          readOnly={isLive}
          hint={
            isLive
              ? 'Visitor-facing URL segment. Fixed at creation, because changing it would break every link already handed out.'
              : 'Used for tenant-facing links and previews.'
          }
        >
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
          disabled={isLive && !canChangeStatus}
          onChange={(isActive) => setDraft((current) => ({ ...current, isActive }))}
          label="Museum is active"
        />

        {isLive && !canChangeStatus ? (
          <DemoDataNote provenance="pending">
            Suspending or reactivating a museum is a system administrator decision, so the toggle is
            read-only here.
          </DemoDataNote>
        ) : null}

        {isLive ? (
          <DemoDataNote>
            City and country stay in this browser. The museum record has no location column.
          </DemoDataNote>
        ) : null}
      </div>

      <div className={styles.rowActions}>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save museum settings'}
        </Button>
      </div>
    </TenantSettingsLayout>
  )
}
