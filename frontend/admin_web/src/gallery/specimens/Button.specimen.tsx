import { useState, type ReactElement } from 'react'

import { Button } from '../../kit/Button/Button.tsx'
import type { StateFilter } from '../GalleryNav.tsx'
import { PlusIcon, SpecimenStack } from './SpecimenStack.tsx'
import styles from '../Gallery.module.css'

const NA_NOTES = [
  {
    state: 'loading' as const,
    reason:
      'Does not apply: a button’s in-flight condition is busy, which preserves the label.',
  },
  {
    state: 'empty' as const,
    reason: 'Does not apply: a button is not a data region.',
  },
  {
    state: 'failure' as const,
    reason: 'Does not apply: a failed action produces a Toast, not an inline button state.',
  },
  {
    state: 'unauthorized' as const,
    reason:
      'Does not apply: a control the user’s role forbids is absent, not disabled (spec §8.5).',
  },
] as const

export function ButtonSpecimen({ stateFilter }: { readonly stateFilter: StateFilter }): ReactElement {
  const [busy, setBusy] = useState(false)

  return (
    <SpecimenStack stateFilter={stateFilter} notes={[...NA_NOTES]}>
      {(state) => {
        if (state === 'ready') {
          return (
            <div className={styles.buttonGrid}>
              <div className={styles.variantRow}>
                <Button tone="primary">Save</Button>
                <Button tone="secondary">Cancel</Button>
                <Button tone="ghost">View details</Button>
                <Button tone="danger">Delete</Button>
              </div>
              <div className={styles.variantRow}>
                <Button tone="primary" size="lg">
                  Large primary
                </Button>
                <Button tone="primary" compact>
                  Compact
                </Button>
                <Button tone="primary" leadingIcon={<PlusIcon />}>
                  Add room
                </Button>
                <Button tone="primary" iconOnly label="Add" icon={<PlusIcon />} />
              </div>
              <div className={styles.variantRow}>
                <Button
                  tone="primary"
                  busy={busy}
                  onClick={() => {
                    setBusy(true)
                    window.setTimeout(() => setBusy(false), 1200)
                  }}
                >
                  Publish
                </Button>
                <Button tone="primary" disabled disabledReason="Not editable until billing is connected.">
                  Pending integration
                </Button>
                <Button tone="secondary" fullWidth>
                  Full width secondary
                </Button>
              </div>
            </div>
          )
        }

        if (state === 'integrationPending') {
          return (
            <Button tone="primary" disabled disabledReason="Not editable until billing is connected.">
              Publish
            </Button>
          )
        }

        return null
      }}
    </SpecimenStack>
  )
}
