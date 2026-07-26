import { useEffect, useState, type ReactElement } from 'react'

import { Button, Field, Select, StateBlock, TextInput, useToast } from '../../kit/index.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type GateSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

const GATE_MODE_OPTIONS = [
  { value: 'ticket_code', label: 'Ticket code scan' },
  { value: 'staff_assisted', label: 'Staff-assisted check-in' },
] as const

export function GateSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setGate, status, loadError, isLive } = useTenantSettingsStore()
  const [draft, setDraft] = useState<GateSettingsForm>(value.gate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(value.gate)
  }, [value.gate])

  async function save(): Promise<void> {
    if (saving) return
    setSaving(true)
    try {
      const result = await setGate(draft)
      if (!result.ok) {
        show({ tone: 'danger', message: result.message })
        return
      }
      show({ tone: 'success', message: 'Ticket gate settings saved.' })
    } finally {
      setSaving(false)
    }
  }

  if (status !== 'ready') {
    return (
      <TenantSettingsLayout
        section="gate"
        title="Ticket gate configuration"
        description="Where the visitor app sends a ticket code to be checked."
      >
        <StateBlock
          size="region"
          state={
            status === 'loading'
              ? { kind: 'loading', label: 'Loading gate settings' }
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
      section="gate"
      title="Ticket gate configuration"
      description="Where the visitor app sends a ticket code to be checked."
    >
      <div className={styles.formGrid}>
        <Field
          id="settings-gate-validation-url"
          label="Ticket validation URL"
          hint="The museum's own endpoint. The server posts each code here and trusts the answer. Leave blank to accept any code."
        >
          {(control) => (
            <TextInput
              {...control}
              value={draft.ticketValidationUrl}
              onChange={(ticketValidationUrl) =>
                setDraft((current) => ({ ...current, ticketValidationUrl }))
              }
              type="url"
              inputMode="url"
              placeholder="https://tickets.example.org/validate"
            />
          )}
        </Field>

        <Field id="settings-gate-mode" label="Gate mode">
          {(control) => (
            <Select
              {...control}
              value={draft.gateMode}
              onChange={(gateMode) =>
                setDraft((current) => ({
                  ...current,
                  gateMode: gateMode as GateSettingsForm['gateMode'],
                }))
              }
              options={GATE_MODE_OPTIONS}
            />
          )}
        </Field>

        <Field id="settings-gate-prefix" label="Allowed ticket prefix">
          {(control) => (
            <TextInput
              {...control}
              value={draft.allowedTicketPrefix}
              onChange={(allowedTicketPrefix) =>
                setDraft((current) => ({ ...current, allowedTicketPrefix }))
              }
            />
          )}
        </Field>

        <Field id="settings-gate-window" label="Grace window (minutes)">
          {(control) => (
            <TextInput
              {...control}
              value={draft.graceWindowMinutes}
              onChange={(graceWindowMinutes) =>
                setDraft((current) => ({ ...current, graceWindowMinutes }))
              }
              inputMode="numeric"
            />
          )}
        </Field>

        {isLive ? (
          <DemoDataNote>
            The validation URL is the only gate setting the server holds. Mode, prefix, and grace
            window are kept in this browser.
          </DemoDataNote>
        ) : null}
      </div>

      <div className={styles.rowActions}>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save gate settings'}
        </Button>
      </div>
    </TenantSettingsLayout>
  )
}
