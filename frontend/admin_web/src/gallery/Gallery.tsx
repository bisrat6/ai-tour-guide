import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

import type { Plane } from '../tokens/semantic.ts'
import { ToastProvider } from '../kit/Toast/ToastProvider.tsx'

import styles from './Gallery.module.css'
import { GalleryNav, StateSwitcher, type StateFilter } from './GalleryNav.tsx'
import { GallerySpecimen } from './GallerySpecimen.tsx'
import { ButtonSpecimen } from './specimens/Button.specimen.tsx'
import { DataTableSpecimen } from './specimens/DataTable.specimen.tsx'
import { FieldSpecimen } from './specimens/Field.specimen.tsx'
import { FilterChipSpecimen } from './specimens/FilterChip.specimen.tsx'
import { GroupedBarChartSpecimen } from './specimens/GroupedBarChart.specimen.tsx'
import { KpiCardSpecimen } from './specimens/KpiCard.specimen.tsx'
import { PanelSpecimen } from './specimens/Panel.specimen.tsx'
import { StatusBadgeSpecimen } from './specimens/StatusBadge.specimen.tsx'
import { TabsSpecimen } from './specimens/Tabs.specimen.tsx'
import {
  BulkActionBarGallerySpecimen,
  ModalGallerySpecimen,
  PeekPanelGallerySpecimen,
  ToastGallerySpecimen,
} from './specimens/OverlaySpecimens.tsx'
import { useHashSection } from './useHashSection.ts'

const GALLERY_SECTIONS = [
  { id: 'button', label: 'Button' },
  { id: 'field', label: 'Field' },
  { id: 'filter-chip', label: 'Filter chip' },
  { id: 'status-badge', label: 'Status badge' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'data-table', label: 'Data table' },
  { id: 'bulk-action-bar', label: 'Bulk-action bar' },
  { id: 'peek-panel', label: 'Peek panel' },
  { id: 'modal', label: 'Modal' },
  { id: 'toast', label: 'Toast' },
  { id: 'kpi-card', label: 'KPI card' },
  { id: 'chart', label: 'Grouped bar chart' },
  { id: 'panel', label: 'Integration-pending panel' },
] as const

type PlaneMode = 'both' | Plane

const W1_SECTIONS = new Set(['button', 'field', 'filter-chip', 'status-badge', 'tabs'])
const W3_SECTIONS = new Set(['bulk-action-bar', 'peek-panel', 'modal', 'toast'])
const W4_SECTIONS = new Set(['data-table'])

const W1_CONTRACTS: Readonly<Record<string, string>> = {
  button: 'Near-black primary, 44px floor, busy and disabledReason patterns.',
  field: 'Field scaffold with TextInput, TextArea, native Select, and Checkbox.',
  'filter-chip': 'Sibling trigger and clear buttons; custom listbox menu.',
  'status-badge': 'Tint pill with marker glyph inheriting label colour.',
  tabs: 'Roving tabindex, automatic and manual activation, TabPanel.',
}

const W2_CONTRACTS: Readonly<Record<string, string>> = {
  'kpi-card':
    'KPI card — provenance markers (demo / pending / live), tabular nums, all five KitState variants.',
  chart:
    'Grouped bar chart — Chart.js wrapper, series toggle, accessible data table, token-resolved canvas colours.',
  panel:
    'Panel and IntegrationPendingPanel — dashed border for pending integrations, neutral markers only.',
}

const W4_CONTRACTS: Readonly<Record<string, string>> = {
  'data-table':
    'Data table — real table semantics, sort, search, FilterChip, selection, pagination, peek activate, all five states.',
}

function renderW1Specimen(sectionId: string, stateFilter: StateFilter): ReactElement | null {
  if (sectionId === 'button') return <ButtonSpecimen stateFilter={stateFilter} />
  if (sectionId === 'field') return <FieldSpecimen stateFilter={stateFilter} />
  if (sectionId === 'filter-chip') return <FilterChipSpecimen stateFilter={stateFilter} />
  if (sectionId === 'status-badge') return <StatusBadgeSpecimen stateFilter={stateFilter} />
  if (sectionId === 'tabs') return <TabsSpecimen stateFilter={stateFilter} />
  return null
}

function renderW2Specimen(
  sectionId: string,
  stateFilter: StateFilter,
  plane: Plane,
): ReactElement | null {
  if (sectionId === 'kpi-card') {
    return <KpiCardSpecimen stateFilter={stateFilter} />
  }
  if (sectionId === 'chart') {
    return <GroupedBarChartSpecimen stateFilter={stateFilter} planeKey={plane} />
  }
  if (sectionId === 'panel') {
    return <PanelSpecimen stateFilter={stateFilter} />
  }
  return null
}

function renderW4Specimen(sectionId: string, stateFilter: StateFilter): ReactElement | null {
  if (sectionId === 'data-table') {
    return <DataTableSpecimen stateFilter={stateFilter} />
  }
  return null
}

/** Phase 2 component gallery shell — specimens arrive in W1–W4. */
export function Gallery(): ReactElement {
  const [activeSection] = useHashSection('button')
  const [planeMode, setPlaneMode] = useState<PlaneMode>('both')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [alwaysFocus, setAlwaysFocus] = useState(false)

  const rootClass = useMemo(() => {
    const classes = [styles.gallery]
    if (reducedMotion) classes.push(styles.galleryReducedMotion)
    if (alwaysFocus) classes.push(styles.galleryAlwaysFocus)
    return classes.join(' ')
  }, [alwaysFocus, reducedMotion])

  return (
    <ToastProvider>
    <div className={rootClass}>
      <a href="#component-index" className={`${styles.skipLink} text-body`}>
        Skip to component index
      </a>

      <header className={styles.header}>
        <p className="column-header">Adwa admin kit</p>
        <h1 className="text-title">Phase 2 gallery</h1>
        <p className={`${styles.lede} text-body-large`}>
          Review surface for shared UI components in both planes and all five states.
          Specimens mount here as W1–W4 land.
        </p>

        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup} role="group" aria-label="Plane display">
            <span className={`${styles.toolbarLabel} text-caption`}>Plane</span>
            {(['both', 'tenant', 'control'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  planeMode === mode
                    ? `${styles.toolbarButton} ${styles.toolbarButtonActive} text-caption`
                    : `${styles.toolbarButton} text-caption`
                }
                aria-pressed={planeMode === mode}
                onClick={() => setPlaneMode(mode)}
              >
                {mode === 'both' ? 'Both planes' : mode === 'tenant' ? 'Tenant' : 'Control'}
              </button>
            ))}
          </div>

          <StateSwitcher value={stateFilter} onChange={setStateFilter} />

          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={
                reducedMotion
                  ? `${styles.toolbarButton} ${styles.toolbarButtonActive} text-caption`
                  : `${styles.toolbarButton} text-caption`
              }
              aria-pressed={reducedMotion}
              onClick={() => setReducedMotion((current) => !current)}
            >
              Reduced motion: {reducedMotion ? 'on' : 'off'}
            </button>
            <button
              type="button"
              className={
                alwaysFocus
                  ? `${styles.toolbarButton} ${styles.toolbarButtonActive} text-caption`
                  : `${styles.toolbarButton} text-caption`
              }
              aria-pressed={alwaysFocus}
              onClick={() => setAlwaysFocus((current) => !current)}
            >
              Always show focus rings: {alwaysFocus ? 'on' : 'off'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <div id="component-index">
          <GalleryNav sections={GALLERY_SECTIONS} activeSection={activeSection} />
        </div>

        <main className={styles.main}>
          {GALLERY_SECTIONS.map((section) => {
            const overlayProps = { planeMode, stateFilter }

            if (section.id === 'modal') {
              return <ModalGallerySpecimen key={section.id} {...overlayProps} />
            }
            if (section.id === 'toast') {
              return <ToastGallerySpecimen key={section.id} {...overlayProps} />
            }
            if (section.id === 'peek-panel') {
              return <PeekPanelGallerySpecimen key={section.id} {...overlayProps} />
            }
            if (section.id === 'bulk-action-bar') {
              return <BulkActionBarGallerySpecimen key={section.id} {...overlayProps} />
            }

            const w1Contract = W1_CONTRACTS[section.id]
            const w2Contract = W2_CONTRACTS[section.id]
            const w4Contract = W4_CONTRACTS[section.id]
            const isW1 = W1_SECTIONS.has(section.id)
            const isW2 = w2Contract !== undefined
            const isW3 = W3_SECTIONS.has(section.id)
            const isW4 = W4_SECTIONS.has(section.id)
            const w1Content = isW1 ? renderW1Specimen(section.id, stateFilter) : null
            const w4Content = isW4 ? renderW4Specimen(section.id, stateFilter) : null

            return (
              <GallerySpecimen
                key={section.id}
                id={section.id}
                name={section.label}
                contract={
                  w1Contract ??
                  w2Contract ??
                  w4Contract ??
                  `${section.label} component contract — implementation pending.`
                }
                planeMode={planeMode}
                stateFilter={stateFilter}
                hidePendingNote={isW1 || isW2 || isW3 || isW4}
                {...(isW2
                  ? {
                      renderContent: (plane: Plane) =>
                        renderW2Specimen(section.id, stateFilter, plane),
                    }
                  : {})}
                {...(w1Content !== null ? { children: w1Content } : {})}
                {...(w4Content !== null ? { children: w4Content } : {})}
              />
            )
          })}

          <p className={`${styles.emptyState} text-body`}>
            Foundation primitives (StateBlock, Skeleton, StatusMarkerGlyph) are available from{' '}
            <code>src/kit/index.ts</code>. Component specimens will mount in the sections above as
            W1–W4 complete.
          </p>
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}
