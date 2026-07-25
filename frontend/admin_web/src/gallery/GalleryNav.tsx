import type { StateKind } from '../kit/types.ts'

import type { ReactElement } from 'react'

import styles from './Gallery.module.css'

export type GallerySection = {
  readonly id: string
  readonly label: string
}

export type GalleryNavProps = {
  readonly sections: readonly GallerySection[]
  readonly activeSection: string
}

/** In-page component index — real anchor links for keyboard traversal. */
export function GalleryNav({ sections, activeSection }: GalleryNavProps): ReactElement {
  return (
    <nav className={styles.nav} aria-label="Components">
      <ul className={styles.navList}>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={
                activeSection === section.id
                  ? `${styles.navLink} ${styles.navLinkActive} text-body`
                  : `${styles.navLink} text-body`
              }
              {...(activeSection === section.id ? { 'aria-current': 'true' as const } : {})}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export type StateFilter = 'all' | StateKind

export type StateSwitcherProps = {
  readonly value: StateFilter
  readonly onChange: (next: StateFilter) => void
}

const STATE_OPTIONS: readonly { readonly value: StateFilter; readonly label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'ready', label: 'Ready' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Empty' },
  { value: 'failure', label: 'Failure' },
  { value: 'unauthorized', label: 'Unauthorized' },
  { value: 'integrationPending', label: 'Integration pending' },
]

/** Per-specimen state picker for focused inspection. */
export function StateSwitcher({ value, onChange }: StateSwitcherProps): ReactElement {
  return (
    <div className={styles.stateSwitcher} role="group" aria-label="State filter">
      {STATE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? `${styles.toolbarButton} ${styles.toolbarButtonActive} text-caption`
              : `${styles.toolbarButton} text-caption`
          }
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
