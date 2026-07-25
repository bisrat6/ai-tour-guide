import type { ReactElement } from 'react'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import styles from './PeekPanel.module.css'

import { Button } from '../Button/Button.tsx'
import { CrossIcon } from '../internal/CrossIcon.tsx'
import { useBodyScrollLock } from '../internal/useBodyScrollLock.ts'
import { useDismiss } from '../internal/useDismiss.ts'
import { useFocusTrap } from '../internal/useFocusTrap.ts'
import { Skeleton } from '../State/Skeleton.tsx'
import { StateBlock } from '../State/StateBlock.tsx'
import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import { TabPanel, Tabs, TabsLoadingStrip } from '../Tabs/index.ts'
import { TONE_MARKER } from '../StatusBadge/StatusBadge.types.ts'
import { resolveState, type KitState, type StatusTone } from '../types.ts'
import type { PeekPanelProps } from './PeekPanel.types.ts'

function statusClass(tone: StatusTone): string {
  if (tone === 'danger') return styles.statusDanger
  if (tone === 'warning') return styles.statusWarning
  if (tone === 'neutral') return styles.statusNeutral
  return styles.status
}

function focusTableFallback(): void {
  const tableRegion = document.querySelector<HTMLElement>('[data-table-region]')
  if (tableRegion !== null) {
    tableRegion.focus()
    return
  }
  const root = document.getElementById('root')
  if (root !== null) {
    root.tabIndex = -1
    root.focus()
  }
}

function PeekPanelBody({
  state,
  tabs,
  activeTabId,
}: {
  readonly state: PeekPanelProps['state']
  readonly tabs: PeekPanelProps['tabs']
  readonly activeTabId: string
}): ReactElement {
  const resolved = resolveState(state)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  if (resolved.kind === 'loading') {
    return (
      <div className={styles.fieldGrid}>
        <Skeleton region="body" shape="text" lines={4} />
      </div>
    )
  }

  if (resolved.kind === 'failure') {
    const failureState: Extract<KitState, { kind: 'failure' }> = {
      kind: 'failure',
      title: 'This record did not load',
      body: 'The request failed. Try again, or close and reopen.',
      ...(state?.kind === 'failure' && state.retry !== undefined ? { retry: state.retry } : {}),
    }
    return <StateBlock state={failureState} />
  }

  if (resolved.kind === 'unauthorized') {
    return (
      <StateBlock
        state={{
          kind: 'unauthorized',
          title: 'You do not have access to this record',
          body: 'Your role does not include it.',
        }}
      />
    )
  }

  if (resolved.kind === 'integrationPending') {
    return <StateBlock state={resolved} size="region" />
  }

  if (resolved.kind === 'empty') {
    return <StateBlock state={resolved} size="region" />
  }

  return <>{activeTab?.content ?? null}</>
}

/** Detail peek panel — overlay (non-modal) or sheet (modal) variant. */
export function PeekPanel({
  open,
  title,
  museumName,
  subtitle,
  status,
  tabs,
  activeTabId,
  onTabChange,
  footer,
  onClose,
  returnFocusTo,
  variant = 'overlay',
  state,
  width = 'md',
}: PeekPanelProps): ReactElement | null {
  const titleId = useId()
  const tabsIdPrefix = useId().replace(/:/g, '')
  const panelRef = useRef<HTMLDivElement>(null)
  const isSheet = variant === 'sheet'
  const resolved = resolveState(state)
  const showSensitiveMeta = resolved.kind !== 'unauthorized'

  useBodyScrollLock(open && isSheet)
  useFocusTrap(panelRef, open && isSheet)

  useLayoutEffect(() => {
    if (open) return
    const explicit = returnFocusTo.current
    if (explicit !== null && document.contains(explicit)) {
      explicit.focus()
      return
    }
    focusTableFallback()
  }, [open, returnFocusTo])

  useDismiss({
    enabled: open,
    onDismiss: onClose,
    containerRef: panelRef,
    dismissOnEscape: true,
    dismissOnOutsidePress: isSheet,
  })

  useEffect(() => {
    if (!open) return

    if (isSheet) {
      document.getElementById('root')?.setAttribute('inert', '')
    }

    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      if (isSheet) document.getElementById('root')?.removeAttribute('inert')
    }
  }, [open, isSheet])

  if (!open) return null

  const tabItems = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    ...(tab.count === undefined ? {} : { count: tab.count }),
  }))

  const panel = (
    <>
      {isSheet ? <div className={styles.sheetScrim} aria-hidden="true" /> : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal={isSheet ? true : undefined}
        tabIndex={-1}
        className={`${styles.panel} ${width === 'lg' ? styles.widthLg : styles.widthMd} ${
          isSheet ? styles.sheet : styles.overlay
        }`}
      >
        <header className={styles.header}>
          {resolved.kind === 'loading' ? (
            <div className={styles.loadingMeta}>
              <Skeleton region="header meta" shape="pill" width="6rem" />
              <Skeleton region="header meta" shape="text" width="12rem" />
            </div>
          ) : (
            <>
              <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                  <h2 id={titleId} className={`${styles.title} text-subtitle`}>
                    {museumName !== undefined ? (
                      <span className="museum-name">{museumName}</span>
                    ) : (
                      title
                    )}
                  </h2>
                  {showSensitiveMeta && subtitle !== undefined ? (
                    <p className={`${styles.subtitle} text-body`}>{subtitle}</p>
                  ) : null}
                </div>
                <Button
                  tone="ghost"
                  iconOnly
                  label="Close"
                  icon={<CrossIcon />}
                  onClick={onClose}
                />
              </div>
              {showSensitiveMeta && status !== undefined ? (
                <div className={styles.meta}>
                  <span className={`${styles.status} ${statusClass(status.tone)} text-caption`}>
                    <StatusMarkerGlyph marker={TONE_MARKER[status.tone]} size={12} />
                    {status.label}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </header>

        {resolved.kind === 'loading' ? (
          <>
            <TabsLoadingStrip />
            <div className={styles.body}>
              <PeekPanelBody state={state} tabs={tabs} activeTabId={activeTabId} />
            </div>
          </>
        ) : (
          <Tabs
            label="Record details"
            items={tabItems}
            activeId={activeTabId}
            onChange={onTabChange}
          >
            <div className={styles.body}>
              <TabPanel tabId={activeTabId} idPrefix={tabsIdPrefix} active>
                <PeekPanelBody state={state} tabs={tabs} activeTabId={activeTabId} />
              </TabPanel>
            </div>
          </Tabs>
        )}

        {footer !== undefined && showSensitiveMeta ? (
          <footer className={styles.footer}>{footer}</footer>
        ) : null}
      </div>
    </>
  )

  if (isSheet) return createPortal(panel, document.body)
  return panel
}

/** Static non-portalled replica for gallery stacked views. */
export function PeekPanelReplica({
  title,
  museumName,
  subtitle,
  status,
  tabs,
  activeTabId,
  footer,
  variant = 'overlay',
  width = 'md',
  children,
}: Omit<PeekPanelProps, 'open' | 'onClose' | 'returnFocusTo' | 'onTabChange' | 'state'> & {
  readonly children?: ReactElement
}): ReactElement {
  const titleId = useId()
  const isSheet = variant === 'sheet'

  const tabItems = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    ...(tab.count === undefined ? {} : { count: tab.count }),
  }))

  const panel = (
    <div
      role="presentation"
      aria-hidden="true"
      className={`${styles.panel} ${width === 'lg' ? styles.widthLg : styles.widthMd}`}
    >
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <h2 id={titleId} className={`${styles.title} text-subtitle`}>
              {museumName !== undefined ? (
                <span className="museum-name">{museumName}</span>
              ) : (
                title
              )}
            </h2>
            {subtitle !== undefined ? (
              <p className={`${styles.subtitle} text-body`}>{subtitle}</p>
            ) : null}
          </div>
          <span className={styles.headerRow}>
            <CrossIcon />
          </span>
        </div>
        {status !== undefined ? (
          <div className={styles.meta}>
            <span className={`${styles.status} ${statusClass(status.tone)} text-caption`}>
              <StatusMarkerGlyph marker={TONE_MARKER[status.tone]} size={12} />
              {status.label}
            </span>
          </div>
        ) : null}
      </header>
      <Tabs label="Record details" items={tabItems} activeId={activeTabId} onChange={() => undefined}>
        <div className={styles.body}>{children}</div>
      </Tabs>
      {footer !== undefined ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  )

  return (
    <div className={styles.replicaHost}>
      {isSheet ? <div className={styles.replicaBackdrop} /> : null}
      <div className={styles.replicaPanel}>{panel}</div>
    </div>
  )
}
