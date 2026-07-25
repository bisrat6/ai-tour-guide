import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../../kit/index.ts'
import styles from './LandingPage.module.css'

type DoorArea = {
  readonly name: string
  readonly detail: string
}

type Door = {
  readonly id: string
  readonly plane: 'tenant' | 'control'
  readonly eyebrow: string
  readonly title: string
  readonly summary: string
  readonly areas: readonly DoorArea[]
  readonly ctaLabel: string
  readonly ctaPath: string
}

/**
 * Each door is rendered inside its own plane container, so the light/dark split
 * a visitor sees here is the same signal the product uses everywhere else. The
 * area lists are the real navigation of each console, not marketing copy.
 */
const doors: readonly Door[] = [
  {
    id: 'tenant',
    plane: 'tenant',
    eyebrow: 'Tenant plane',
    title: 'For museum teams',
    summary:
      'Sign in to your own museum and nothing else. Put the rooms in the order a visitor walks them, write the context your guide speaks from, and approve narration before anyone hears it.',
    areas: [
      { name: 'Overview', detail: 'Readiness to open, and what changed recently' },
      { name: 'Rooms and items', detail: 'Tour order, room authoring, object records' },
      { name: 'Narration', detail: 'Scripts, generation, and review before release' },
      { name: 'Team and settings', detail: 'Staff access, ticket gate, guide persona, voice' },
    ],
    ctaLabel: 'Museum sign in',
    ctaPath: '/sign-in',
  },
  {
    id: 'control',
    plane: 'control',
    eyebrow: 'Control plane',
    title: 'For the Adwa team',
    summary:
      'Run the whole fleet. Onboard and suspend museums, watch the language, speech, and storage adapters, attribute cost per museum, and enter any tenant to help.',
    areas: [
      { name: 'Fleet', detail: 'Every museum, its status, and the way in' },
      { name: 'Health', detail: 'Provider adapter state and rate-limit pressure' },
      { name: 'Spend', detail: 'Cost attributed to the museum that caused it' },
      { name: 'Audit', detail: 'Cross-tenant change history' },
    ],
    ctaLabel: 'Operator sign in',
    ctaPath: '/operator/sign-in',
  },
]

export function LandingPage(): ReactElement {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <span className={styles.brand}>
          <span aria-hidden="true" className={styles.brandMark} />
          Adwa
        </span>
        <Button compact tone="secondary" onClick={() => navigate('/sign-in')}>
          Museum sign in
        </Button>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={`column-header ${styles.eyebrow}`}>Adwa platform</p>
            <h1 className={styles.headline}>The console behind the guide.</h1>
            <p className={`text-lead ${styles.lead}`}>
              Adwa gives a museum visitor an AI guide that narrates every room and object in their
              own language. This is where that tour is built, and where the fleet running it is
              operated.
            </p>
            <p className={`text-body-large ${styles.flagship}`}>
              Now serving the <span className="museum-name">Adwa Victory Memorial</span>
            </p>
          </div>
        </section>

        <section aria-labelledby="doors-heading" className={styles.doors}>
          <h2 className={styles.visuallyHidden} id="doors-heading">
            Choose how you sign in
          </h2>

          {doors.map((door) => (
            <div className={styles.door} data-plane={door.plane} key={door.id}>
              <div className={styles.doorInner}>
                <p className={`column-header ${styles.doorEyebrow}`}>{door.eyebrow}</p>
                <h3 className={`text-title ${styles.doorTitle}`}>{door.title}</h3>
                <p className={`text-body-large ${styles.doorSummary}`}>{door.summary}</p>

                <ul className={styles.areaList}>
                  {door.areas.map((area) => (
                    <li className={styles.area} key={area.name}>
                      <span className={`text-body ${styles.areaName}`}>{area.name}</span>
                      <span className={`text-body ${styles.areaDetail}`}>{area.detail}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={styles.doorCta}
                  onClick={() => navigate(door.ctaPath)}
                  size="lg"
                >
                  {door.ctaLabel}
                </Button>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={`text-body ${styles.footerNote}`}>
          Two planes, one platform. A museum administrator has no route, no control, and no rendered
          hint that another museum exists — absent, not disabled.
        </p>
      </footer>
    </div>
  )
}
