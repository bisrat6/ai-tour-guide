/**
 * The museum's subscription, read from `GET /admin/billing/status`.
 *
 * Read-only on purpose. The backend can open a checkout and take a Chapa
 * payment, but nothing here starts one — a plan change is a conversation with
 * the operator today, and a button that charged money would need a return page
 * to land on, which does not exist yet.
 *
 * Every number on this page is read from the server. The limits, though, are
 * currently advisory: `requireWithinTierLimit` exists and is tested but is
 * mounted on no route, because BASIC allows one room and the seeded museums
 * have four. So a full bar here does not yet stop a create, and the page says
 * so rather than implying an enforcement that is not switched on.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'

import * as api from '../../api/adminApi.ts'
import { isLiveApi } from '../../api/config.ts'
import { isApiError } from '../../api/errors.ts'
import type {
  ApiPayment,
  ApiPaymentStatus,
  ApiSubscriptionStatus,
  ApiSubscriptionTier,
  BillingStatusResponse,
} from '../../api/types.ts'
import {
  DataTable,
  Panel,
  StateBlock,
  StatusBadge,
  type Column,
  type StatusTone,
} from '../../kit/index.ts'
import { useActiveMuseumId } from '../auth/useActiveMuseumId.ts'
import { DemoDataNote } from '../common/DemoDataNote.tsx'
import styles from './BillingPage.module.css'

const TIER_LABELS: Readonly<Record<ApiSubscriptionTier, string>> = {
  BASIC: 'Basic',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const SUBSCRIPTION_LABELS: Readonly<Record<ApiSubscriptionStatus, string>> = {
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  CANCELED: 'Canceled',
}

const PAYMENT_LABELS: Readonly<Record<ApiPaymentStatus, string>> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
}

function subscriptionTone(status: ApiSubscriptionStatus): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAST_DUE') return 'warning'
  return 'danger'
}

function paymentTone(status: ApiPaymentStatus): StatusTone {
  if (status === 'PAID') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'danger'
}

function formatBirr(amountEtb: string): string {
  const value = Number.parseFloat(amountEtb)
  if (Number.isNaN(value)) return `${amountEtb} ETB`
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(value)} ETB`
}

function formatDate(iso: string | null): string {
  if (iso === null) return '—'
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? iso : at.toISOString().slice(0, 10)
}

/** Null is unlimited on this tier, which is a fact rather than a missing value. */
function UsageRow({
  label,
  used,
  limit,
}: {
  readonly label: string
  readonly used: number
  readonly limit: number | null
}): ReactElement {
  const unlimited = limit === null
  const share = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit)
  const fillClass =
    share >= 1 ? styles.meterDanger : share >= 0.8 ? styles.meterWarning : undefined

  return (
    <li className={styles.usageRow}>
      <div className={styles.usageHeader}>
        <span className="text-body">{label}</span>
        <span className="text-caption numeric">
          {used} {unlimited ? 'used, no limit on this plan' : `of ${limit}`}
        </span>
      </div>
      {unlimited ? null : (
        <div
          className={styles.meter}
          role="img"
          aria-label={`${label}: ${used} of ${limit} used`}
          style={{ ['--usage-share' as string]: `${share}` }}
        >
          <span className={`${styles.meterFill} ${fillClass ?? ''}`} />
        </div>
      )}
    </li>
  )
}

const PAYMENT_COLUMNS: readonly Column<ApiPayment>[] = [
  {
    id: 'created',
    header: 'Opened',
    sortable: true,
    sortValue: (payment) => Date.parse(payment.createdAt) || 0,
    cell: (payment) => (
      <span className={`text-caption ${styles.monoDate}`}>{formatDate(payment.createdAt)}</span>
    ),
  },
  {
    id: 'tier',
    header: 'Plan',
    sortable: true,
    sortValue: (payment) => payment.tier,
    cell: (payment) => <span className="text-body">{TIER_LABELS[payment.tier]}</span>,
  },
  {
    id: 'amount',
    header: 'Amount',
    numeric: true,
    sortable: true,
    sortValue: (payment) => Number.parseFloat(payment.amountEtb) || 0,
    cell: (payment) => <span className="text-body numeric">{formatBirr(payment.amountEtb)}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (payment) => payment.status,
    cell: (payment) => (
      <StatusBadge tone={paymentTone(payment.status)} label={PAYMENT_LABELS[payment.status]} />
    ),
  },
  {
    id: 'paid',
    header: 'Paid',
    sortable: true,
    sortValue: (payment) => (payment.paidAt === null ? 0 : (Date.parse(payment.paidAt) || 0)),
    cell: (payment) => (
      <span className={`text-caption ${styles.monoDate}`}>{formatDate(payment.paidAt)}</span>
    ),
  },
  {
    id: 'reference',
    header: 'Provider reference',
    sortable: false,
    cell: (payment) => (
      <span className={`text-caption ${styles.monoDate}`}>{payment.chapaReference ?? '—'}</span>
    ),
  },
]

export function BillingPage(): ReactElement {
  const museumId = useActiveMuseumId()

  const [billing, setBilling] = useState<BillingStatusResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    isLiveApi ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!isLiveApi) return

    let current = true
    setStatus('loading')
    setLoadError(null)

    api
      .getBillingStatus({ museumId, limit: 20 })
      .then((response) => {
        if (!current) return
        setBilling(response)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!current) return
        setBilling(null)
        setStatus('error')
        setLoadError(isApiError(error) ? error.message : 'Could not load the subscription.')
      })

    return () => {
      current = false
    }
  }, [museumId, reloadToken])

  if (!isLiveApi) {
    return (
      <div className={styles.page}>
        <header className={styles.headerCard}>
          <h1 className="text-title">Billing</h1>
          <DemoDataNote>
            No API is configured, so there is no subscription to read. Point VITE_API_BASE_URL at
            the backend to see this museum's plan, usage, and payments.
          </DemoDataNote>
        </header>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerCard}>
        <h1 className="text-title">Billing</h1>
        <p className={`text-body ${styles.muted}`}>
          This museum's plan, what it allows, and every payment against it.
        </p>
      </header>

      {status === 'loading' ? (
        <StateBlock state={{ kind: 'loading', label: 'the subscription' }} />
      ) : null}

      {status === 'error' ? (
        <StateBlock
          state={{
            kind: 'failure',
            title: 'The subscription did not load',
            body: loadError ?? 'The request failed.',
            retry: { label: 'Try again', onAct: reload },
          }}
        />
      ) : null}

      {status === 'ready' && billing !== null ? (
        <>
          <Panel title="Current plan">
            <div className={styles.summaryRow}>
              <div className={styles.summaryItem}>
                <p className="column-header">Plan</p>
                <p className="text-subtitle">{TIER_LABELS[billing.tier]}</p>
              </div>
              <div className={styles.summaryItem}>
                <p className="column-header">Status</p>
                <StatusBadge
                  tone={subscriptionTone(billing.subscriptionStatus)}
                  label={SUBSCRIPTION_LABELS[billing.subscriptionStatus]}
                />
              </div>
              <div className={styles.summaryItem}>
                <p className="column-header">Renews</p>
                <p className="text-body numeric">{formatDate(billing.subscriptionRenewsAt)}</p>
              </div>
              <div className={styles.summaryItem}>
                <p className="column-header">Days remaining</p>
                <p className="text-body numeric">
                  {billing.daysUntilRenewal === null ? '—' : billing.daysUntilRenewal}
                </p>
              </div>
            </div>
            <p className={`text-caption ${styles.muted}`}>
              Changing plan is not self-service yet. Ask a system administrator, who can move this
              museum to another tier.
            </p>
          </Panel>

          <Panel
            title="Usage against this plan"
            description="Both counts come from the server. The allowances are the plan's, not a guide."
          >
            <ul className={styles.usageList}>
              <UsageRow label="Rooms" used={billing.usage.rooms} limit={billing.limits.maxRooms} />
              <UsageRow
                label="Administrator accounts"
                used={billing.usage.adminUsers}
                limit={billing.limits.maxAdminUsers}
              />
            </ul>
            <p className={`text-caption ${styles.muted}`}>
              {billing.limits.maxItemsPerRoom === null
                ? 'Items per room are unlimited on this plan.'
                : `Each room may hold up to ${billing.limits.maxItemsPerRoom} items. That is counted per room, so it has no single figure here.`}
            </p>
            <DemoDataNote provenance="pending">
              Going over an allowance does not block anything yet. The check is written but is not
              switched on, so a room or an account can still be added past the figures above.
            </DemoDataNote>
          </Panel>

          <Panel title="Payment history">
            {billing.payments.length === 0 ? (
              <StateBlock
                size="inline"
                state={{
                  kind: 'empty',
                  title: 'No payments yet',
                  body: 'Nothing has been charged against this museum.',
                }}
              />
            ) : (
              <DataTable
                caption="Payments for this museum"
                columns={PAYMENT_COLUMNS}
                rows={billing.payments}
                rowKey={(payment) => payment.id}
                stickyHeader
              />
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}
