import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

import {
  GroupedBarChart,
  KpiCard,
  Panel,
  ProvenanceTag,
  StatusBadge,
  type StatusTone,
} from '../../kit/index.ts'
import { useScopedTenantContext } from '../operator/scopedTenantContext.tsx'
import { ReadinessSpine } from './ReadinessSpine.tsx'
import {
  ENGAGEMENT_VALUE_SERIES,
  INSIGHTS_MINI_KPIS,
  OVERVIEW_CHART_CATEGORIES,
  OVERVIEW_KPIS,
  OVERVIEW_MUSEUM_NAME,
  OVERVIEW_RECENT_CHANGES,
  OVERVIEW_ROOMS,
  TOP_ROOMS_BY_VISITS,
  VISIT_VOLUME_SERIES,
} from './overviewFixtures.ts'
import styles from './TenantOverviewPage.module.css'

function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatOneDecimal(value: number): string {
  return `${value.toFixed(1)}`
}

function toneLabel(tone: StatusTone): string {
  if (tone === 'success') return 'Ready'
  if (tone === 'warning') return 'Generating'
  if (tone === 'danger') return 'Needs revision'
  return 'Not started'
}

export function TenantOverviewPage(): ReactElement {
  const scoped = useScopedTenantContext()
  const [hiddenVolumeSeries, setHiddenVolumeSeries] = useState<readonly string[]>([])
  const [hiddenValueSeries, setHiddenValueSeries] = useState<readonly string[]>([])

  const statusCounts = useMemo(() => {
    const initial: Record<StatusTone, number> = {
      success: 0,
      warning: 0,
      danger: 0,
      neutral: 0,
    }
    for (const room of OVERVIEW_ROOMS) {
      initial[room.narrationTone] += 1
    }
    return initial
  }, [])

  const readinessPercent = Math.round((statusCounts.success / OVERVIEW_ROOMS.length) * 100)

  return (
    <div className={styles.page}>
      <section className={styles.mainColumn} aria-labelledby="overview-heading">
        <header className={styles.header}>
          <p className={`${styles.museumName} museum-name`}>{OVERVIEW_MUSEUM_NAME}</p>
          <h1 id="overview-heading" className="text-title">
            Overview
          </h1>
        </header>

        <Panel padded={false}>
          <div className={styles.spinePanel}>
            <div className={styles.spineHeader}>
              <h2 className="text-subtitle">Readiness spine</h2>
              <ProvenanceTag provenance="demo" note="room fixtures" />
            </div>
            <p className={`${styles.spineNote} text-body`}>
              Story-order jump control. Marker shapes mirror narration readiness states.
            </p>
            <ReadinessSpine rooms={OVERVIEW_ROOMS} />
            <ul className={styles.spineLegend}>
              <li>
                <StatusBadge
                  tone="success"
                  label={`${statusCounts.success} ready`}
                  detail="Rooms with ready narration"
                />
              </li>
              <li>
                <StatusBadge
                  tone="warning"
                  label={`${statusCounts.warning} generating`}
                  detail="Rooms waiting for generated narration"
                />
              </li>
              <li>
                <StatusBadge
                  tone="danger"
                  label={`${statusCounts.danger} revision`}
                  detail="Rooms blocked on script fixes"
                />
              </li>
              <li>
                <StatusBadge
                  tone="neutral"
                  label={`${statusCounts.neutral} not started`}
                  detail="Rooms without started narration"
                />
              </li>
            </ul>
          </div>
        </Panel>

        <section className={styles.kpiSection} aria-label="Museum key performance indicators">
          {OVERVIEW_KPIS.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>

        <section className={styles.chartsSection} aria-label="Visitor and engagement charts">
          <Panel>
            <GroupedBarChart
              title="Room visit volume"
              description="Grouped bars comparing weekday, weekend, and guided group visits by room order."
              categories={OVERVIEW_CHART_CATEGORIES}
              series={VISIT_VOLUME_SERIES}
              axisLabel="Story-order room number"
              valueFormat={formatWholeNumber}
              provenance="demo"
              hiddenSeriesIds={hiddenVolumeSeries}
              onSeriesToggle={(id, visible) => {
                setHiddenVolumeSeries((current) =>
                  visible ? current.filter((entry) => entry !== id) : [...current, id],
                )
              }}
            />
          </Panel>

          <Panel>
            <GroupedBarChart
              title="Engagement value"
              description="Grouped bars comparing average dwell minutes and completion share by room order."
              categories={OVERVIEW_CHART_CATEGORIES}
              series={ENGAGEMENT_VALUE_SERIES}
              axisLabel="Story-order room number"
              valueFormat={formatOneDecimal}
              provenance="demo"
              hiddenSeriesIds={hiddenValueSeries}
              onSeriesToggle={(id, visible) => {
                setHiddenValueSeries((current) =>
                  visible ? current.filter((entry) => entry !== id) : [...current, id],
                )
              }}
            />
          </Panel>
        </section>

        <Panel title="Room readiness detail">
          <div className={styles.roomListHeader}>
            <p className={`${styles.panelCopy} text-body`}>
              The spine targets these anchors so reviewers can verify each room's state in story order.
            </p>
            <ProvenanceTag provenance="demo" />
          </div>
          <ol className={styles.roomList}>
            {OVERVIEW_ROOMS.map((room) => (
              <li key={room.id} id={`room-${room.id}`} className={styles.roomRow}>
                <div className={styles.roomIdentity}>
                  <p className={`${styles.roomOrder} text-caption numeric`}>{room.order}</p>
                  <div>
                    <p className="text-body">{room.title}</p>
                    <p className={`${styles.roomMeta} text-caption`}>{room.updatedAt}</p>
                  </div>
                </div>
                <div className={styles.roomStatus}>
                  <StatusBadge
                    tone={room.narrationTone}
                    label={toneLabel(room.narrationTone)}
                    marker={room.marker}
                    detail={`${room.title} narration readiness`}
                  />
                  <p className={`${styles.roomMeta} text-caption numeric`}>Completion {room.completion}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Recent changes">
          <div className={styles.rowBetween}>
            <p className={`${styles.panelCopy} text-body`}>
              Latest fixture activity for this museum only.
            </p>
            <ProvenanceTag provenance="demo" />
          </div>
          <ul className={styles.changeList}>
            {OVERVIEW_RECENT_CHANGES.map((entry) => (
              <li key={entry.id} className={styles.changeRow}>
                <div>
                  <p className="text-body">{entry.action}</p>
                  <p className={`${styles.changeMeta} text-caption`}>
                    <span>{entry.target} - {entry.actor}</span>
                    {scoped.isScoped && entry.actorRole === 'system_operator' ? (
                      <StatusBadge tone="warning" label="Operator scoped write" marker="ring" />
                    ) : null}
                  </p>
                </div>
                <div className={styles.changeWhen}>
                  <p className={`${styles.changeMeta} text-caption`}>{entry.when}</p>
                  <ProvenanceTag provenance={entry.provenance} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <aside className={styles.insightsRail} aria-label="Overview insights">
        <Panel title="Readiness gauge">
          <div className={styles.rowBetween}>
            <p className={`${styles.gaugeValue} text-display numeric`}>{readinessPercent}%</p>
            <ProvenanceTag provenance="demo" />
          </div>
          <p className={`${styles.panelCopy} text-caption`}>
            {statusCounts.success} of {OVERVIEW_ROOMS.length} rooms have ready narration.
          </p>
        </Panel>

        <Panel title="Status breakdown">
          <div className={styles.rowBetween}>
            <div className={styles.breakdownBar} role="img" aria-label="Narration readiness breakdown bar">
              <span
                className={`${styles.breakdownSegment} ${styles.breakdownSuccess}`}
                style={{ ['--segment-share' as string]: `${statusCounts.success / OVERVIEW_ROOMS.length}` }}
              />
              <span
                className={`${styles.breakdownSegment} ${styles.breakdownWarning}`}
                style={{ ['--segment-share' as string]: `${statusCounts.warning / OVERVIEW_ROOMS.length}` }}
              />
              <span
                className={`${styles.breakdownSegment} ${styles.breakdownDanger}`}
                style={{ ['--segment-share' as string]: `${statusCounts.danger / OVERVIEW_ROOMS.length}` }}
              />
              <span
                className={`${styles.breakdownSegment} ${styles.breakdownNeutral}`}
                style={{ ['--segment-share' as string]: `${statusCounts.neutral / OVERVIEW_ROOMS.length}` }}
              />
            </div>
            <ProvenanceTag provenance="demo" />
          </div>
          <ul className={styles.insightList}>
            {(['success', 'warning', 'danger', 'neutral'] as const).map((tone) => (
              <li key={tone} className={styles.insightItem}>
                <StatusBadge tone={tone} label={toneLabel(tone)} />
                <span className={`${styles.insightValue} text-caption numeric`}>{statusCounts[tone]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="KPI mini-grid">
          <div className={styles.rowBetween}>
            <p className={`${styles.panelCopy} text-caption`}>Supplementary quick metrics.</p>
            <ProvenanceTag provenance="demo" />
          </div>
          <ul className={styles.miniGrid}>
            {INSIGHTS_MINI_KPIS.map((kpi) => (
              <li key={kpi.label} className={styles.miniKpi}>
                <p className="column-header">{kpi.label}</p>
                <p className={`${styles.miniValue} text-lead numeric`}>
                  {kpi.value ?? '-'}
                </p>
                <ProvenanceTag provenance={kpi.provenance} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Top rooms by visits">
          <div className={styles.rowBetween}>
            <p className={`${styles.panelCopy} text-caption`}>Ranked from overview fixtures.</p>
            <ProvenanceTag provenance="demo" />
          </div>
          <ol className={styles.rankedList}>
            {TOP_ROOMS_BY_VISITS.map((room) => (
              <li key={room.roomId} className={styles.rankedRow}>
                <a href={`#room-${room.roomId}`} className={styles.rankedLink}>
                  <span className="text-body">{room.label}</span>
                  <span className={`${styles.rankedValue} text-caption numeric`}>{room.value}</span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
      </aside>
    </div>
  )
}
