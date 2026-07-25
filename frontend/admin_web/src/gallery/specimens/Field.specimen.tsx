import { useState, type ReactElement } from 'react'

import { Checkbox, Field, Select, TextArea, TextInput } from '../../kit/Field/index.ts'
import { Skeleton } from '../../kit/State/Skeleton.tsx'
import type { StateFilter } from '../GalleryNav.tsx'
import { SpecimenStack } from './SpecimenStack.tsx'
import styles from '../Gallery.module.css'

const NA_NOTES = [
  {
    state: 'empty' as const,
    reason: 'Does not apply: a field with no value shows a placeholder, not an empty state.',
  },
  {
    state: 'failure' as const,
    reason: 'Does not apply at field level: a failed save is a Toast; a failed value is error.',
  },
  {
    state: 'unauthorized' as const,
    reason: 'Does not apply: role-forbidden fields are absent.',
  },
] as const

export function FieldSpecimen({ stateFilter }: { readonly stateFilter: StateFilter }): ReactElement {
  const [title, setTitle] = useState('Adwa Memorial')
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [roomType, setRoomType] = useState('gallery')
  const [agree, setAgree] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  return (
    <SpecimenStack stateFilter={stateFilter} notes={[...NA_NOTES]}>
      {(state) => {
        if (state === 'ready') {
          return (
            <div className={styles.fieldStack}>
              <Field id="field-title" label="Room title" required hint="Shown on the tour map.">
                {(control) => (
                  <TextInput {...control} value={title} onChange={setTitle} placeholder="Enter a title" />
                )}
              </Field>

              <Field
                id="field-search"
                label="Search rooms"
                markOptional
                hint="Filter the table below."
              >
                {(control) => (
                  <TextInput
                    {...control}
                    value={search}
                    onChange={setSearch}
                    type="search"
                    clearable
                    leadingIcon={<SearchIcon />}
                    shortcutHint="⌘K"
                    placeholder="Search by title"
                  />
                )}
              </Field>

              <Field
                id="field-notes"
                label="Curator notes"
                {...(notes.length > 0 && notes.length < 8
                  ? { error: 'Add a little more detail.' }
                  : {})}
              >
                {(control) => (
                  <TextArea
                    {...control}
                    value={notes}
                    onChange={setNotes}
                    rows={3}
                    maxLength={500}
                    showCount
                  />
                )}
              </Field>

              <Field id="field-type" label="Room type" required>
                {(control) => (
                  <Select
                    {...control}
                    value={roomType}
                    onChange={setRoomType}
                    placeholder="Choose a type"
                    options={[
                      { value: 'gallery', label: 'Gallery room' },
                      { value: 'outdoor', label: 'Outdoor stop' },
                      { value: 'foyer', label: 'Foyer' },
                    ]}
                  />
                )}
              </Field>

              <Field id="field-readonly" label="External ID" readOnly>
                {(control) => (
                  <TextInput {...control} value="room-adwa-001" onChange={() => undefined} />
                )}
              </Field>

              <Checkbox checked={agree} onChange={setAgree} label="Publish when saved" id="field-agree" />
              <Checkbox
                checked={selectAll}
                indeterminate={!selectAll}
                onChange={setSelectAll}
                label="Select all rows on this page"
                id="field-select-all"
              />
            </div>
          )
        }

        if (state === 'loading') {
          return (
            <div className={styles.fieldStack}>
              <Skeleton region="field label" shape="line" width="6rem" />
              <Skeleton region="text input" shape="block" height="var(--field-min-height)" />
            </div>
          )
        }

        if (state === 'integrationPending') {
          return (
            <Field
              id="field-voice"
              label="Narration voice"
              disabled
              disabledReason="Not editable until voice provider is connected."
            >
              {(control) => (
                <Select
                  {...control}
                  value=""
                  onChange={() => undefined}
                  options={[{ value: 'en-female-1', label: 'English — warm' }]}
                />
              )}
            </Field>
          )
        }

        return null
      }}
    </SpecimenStack>
  )
}

function SearchIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
