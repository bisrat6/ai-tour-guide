import { useEffect, useState, type ReactElement } from 'react'

import { Button, Field, IntegrationPendingPanel, Select, TextInput, useToast } from '../../kit/index.ts'
import { TenantSettingsLayout } from './TenantSettingsLayout.tsx'
import { useTenantSettingsStore, type GateSettingsForm } from './settingsStore.ts'
import styles from './TenantSettingsLayout.module.css'

const GATE_MODE_OPTIONS = [
  { value: 'ticket_code', label: 'Ticket code scan' },
  { value: 'staff_assisted', label: 'Staff-assisted check-in' },
] as const

export function GateSettingsPage(): ReactElement {
  const { show } = useToast()
  const { value, setGate } = useTenantSettingsStore()
  const [draft, setDraft] = useState<GateSettingsForm>(value.gate)

  useEffect(() => {
    setDraft(value.gate)
  }, [value.gate])

  function save(): void {
    setGate(draft)
    show({ tone: 'success', message: 'Ticket gate settings saved.' })
  }

  return (
    <TenantSettingsLayout
      section="gate"
      title="Ticket gate configuration"
      description="Configure tenant gate behavior used by fixture verification flows."
    >
      <div className={styles.formGrid}>
        <Field id="settings-gate-mode" label="Gate mode">
          {(control) => (
            <Select
              {...control}
              value={draft.gateMode}
              onChange={(gateMode) => setDraft((current) => ({ ...current, gateMode: gateMode as GateSettingsForm['gateMode'] }))}
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

        <IntegrationPendingPanel
          dependency="Ticket validation API"
          body="Live ticket checks are not connected in this phase, so verification calls remain disabled."
          stillUsable="You can still configure gate defaults and save them locally for review."
          variant="inline"
        />

        <Button
          tone="secondary"
          disabled
          disabledReason="Integration pending: ticket validation API is not wired yet."
        >
          Test ticket validation
        </Button>
      </div>

      <div className={styles.rowActions}>
        <Button onClick={save}>Save gate settings</Button>
      </div>
    </TenantSettingsLayout>
  )
}
