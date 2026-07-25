import type { ReactElement, ReactNode } from 'react'
import { NavLink, useParams } from 'react-router-dom'

import { Panel } from '../../kit/index.ts'
import styles from './TenantSettingsLayout.module.css'

type SettingsSection = 'museum' | 'gate' | 'guide' | 'voice'

type SettingsLayoutProps = {
  readonly section: SettingsSection
  readonly title: string
  readonly description: string
  readonly children: ReactNode
}

const LINKS: readonly { section: SettingsSection; label: string }[] = [
  { section: 'museum', label: 'Museum' },
  { section: 'gate', label: 'Ticket gate' },
  { section: 'guide', label: 'AI guide' },
  { section: 'voice', label: 'Voice' },
] as const

function resolveSettingsBase(museumId: string | undefined): string {
  if (museumId === undefined) return '/app/settings'
  return `/operator/tenant/${museumId}/settings`
}

export function TenantSettingsLayout({
  section,
  title,
  description,
  children,
}: SettingsLayoutProps): ReactElement {
  const { museumId } = useParams()
  const base = resolveSettingsBase(museumId)

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div>
          <p className="museum-name">Adwa Memorial Museum</p>
          <h1 className="text-title">Settings</h1>
          <p className={`text-body ${styles.muted}`}>
            Inner settings rail for tenant-scoped museum configuration.
          </p>
        </div>
      </header>

      <section className={styles.layout}>
        <nav className={styles.rail} aria-label="Settings sections">
          <p className="column-header">Configuration</p>
          <ul className={styles.railList}>
            {LINKS.map((link) => (
              <li key={link.section}>
                <NavLink
                  to={`${base}/${link.section}`}
                  className={({ isActive }) => `${styles.railLink} ${isActive ? styles.railLinkActive : ''}`}
                  end
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Panel>
            <p className="column-header">Role boundary</p>
            <p className={`text-caption ${styles.muted}`}>
              Provider-only controls (billing, tenant suspension, cross-tenant policy) are omitted for museum
              administrators.
            </p>
          </Panel>
        </nav>

        <Panel title={title} description={description}>
          <div className={styles.formPanel} data-settings-section={section}>
            {children}
          </div>
        </Panel>
      </section>
    </div>
  )
}
