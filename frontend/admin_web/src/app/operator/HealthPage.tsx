import { useMemo, type ReactElement } from 'react'

import { DataTable, Panel, StatusBadge, type Column } from '../../kit/index.ts'
import {
  PROVIDER_HEALTH_FIXTURES,
  adapterStateLabel,
  adapterStateMarker,
  adapterStateTone,
  pressureLabel,
  pressureMarker,
  pressureTone,
  type ProviderHealthRecord,
} from './phase9Fixtures.ts'
import styles from './OperatorPhase9Pages.module.css'

export function HealthPage(): ReactElement {
  const columns = useMemo<readonly Column<ProviderHealthRecord>[]>(
    () => [
      {
        id: 'adapter',
        header: 'Adapter',
        sortable: true,
        sortValue: (entry) => entry.adapter,
        cell: (entry) => (
          <div className={styles.rowMeta}>
            <span className="text-body">{entry.adapter}</span>
            <span className={`text-caption ${styles.muted}`}>{entry.provider}</span>
          </div>
        ),
      },
      {
        id: 'state',
        header: 'State',
        sortable: true,
        sortValue: (entry) => adapterStateLabel(entry.state),
        cell: (entry) => (
          <StatusBadge
            tone={adapterStateTone(entry.state)}
            marker={adapterStateMarker(entry.state)}
            label={adapterStateLabel(entry.state)}
          />
        ),
      },
      {
        id: 'pressure',
        header: 'Rate-limit pressure',
        sortable: true,
        sortValue: (entry) => pressureLabel(entry.pressure),
        cell: (entry) => (
          <StatusBadge
            tone={pressureTone(entry.pressure)}
            marker={pressureMarker(entry.pressure)}
            label={pressureLabel(entry.pressure)}
          />
        ),
      },
      {
        id: 'note',
        header: 'Operational note',
        sortable: false,
        cell: (entry) => <span className="text-body">{entry.note}</span>,
      },
      {
        id: 'updated',
        header: 'Updated',
        sortable: true,
        sortValue: (entry) => entry.updatedAt,
        cell: (entry) => <span className={`text-caption ${styles.monoDate}`}>{entry.updatedAt}</span>,
      },
    ],
    [],
  )

  const breakerOpenCount = useMemo(
    () => PROVIDER_HEALTH_FIXTURES.filter((entry) => entry.state === 'breaker_open').length,
    [],
  )
  const retryingCount = useMemo(
    () => PROVIDER_HEALTH_FIXTURES.filter((entry) => entry.state === 'retrying').length,
    [],
  )

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div>
            <h1 className="text-title">Health</h1>
            <p className={`text-body ${styles.muted}`}>
              Provider adapter states are modeled from timeout, retry, and circuit-breaker behavior in the backend
              design.
            </p>
          </div>
          <div className={styles.provenanceRow}>
            <StatusBadge tone="neutral" marker="dash" label="Modeled operational state" />
            <StatusBadge tone="warning" marker="ring" label={`${retryingCount} retrying`} />
            <StatusBadge tone="danger" marker="cross" label={`${breakerOpenCount} breaker open`} />
          </div>
        </div>
      </header>

      <Panel>
        <DataTable
          caption="Provider adapter health"
          columns={columns}
          rows={PROVIDER_HEALTH_FIXTURES}
          rowKey={(entry) => entry.id}
          stickyHeader
        />
      </Panel>

      <section className={styles.gridTwo}>
        <Panel
          title="State meaning"
          description="These labels describe behavior, not vanity uptime scores."
        >
          <ul className={styles.list}>
            <li className="text-body">
              <strong>Healthy:</strong> responses are within policy and no breaker pressure is present.
            </li>
            <li className="text-body">
              <strong>Degraded:</strong> requests succeed, but latency or error rate is above target.
            </li>
            <li className="text-body">
              <strong>Retrying:</strong> transient failures are in active backoff retries.
            </li>
            <li className="text-body">
              <strong>Breaker open:</strong> requests are temporarily short-circuited until recovery checks pass.
            </li>
          </ul>
        </Panel>

        <Panel
          title="Rate-limit pressure"
          description="Pressure summarizes throttling risk from provider responses and queue depth."
        >
          <div className={styles.inlineBadges}>
            <StatusBadge tone="success" marker="dot" label="Low" />
            <StatusBadge tone="warning" marker="ring" label="Elevated" />
            <StatusBadge tone="warning" marker="ring" label="High" />
            <StatusBadge tone="danger" marker="cross" label="Saturated" />
          </div>
          <p className={`text-caption ${styles.muted}`}>
            Saturated pressure means operators should expect throttled writes and slower regeneration workflows.
          </p>
        </Panel>
      </section>
    </div>
  )
}
