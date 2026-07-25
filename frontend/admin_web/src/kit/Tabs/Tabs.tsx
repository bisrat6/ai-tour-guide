import {
  useEffect,
  useId,
  useMemo,
  type ReactElement,
} from 'react'

import { useRovingTabIndex } from '../internal/useRovingTabIndex.ts'
import { Skeleton } from '../State/Skeleton.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { TabItem, TabPanelProps, TabsProps } from './Tabs.types.ts'
import styles from './Tabs.module.css'

function disabledReason(item: TabItem): string | undefined {
  return item.disabledReason ?? (item.disabled ? 'Available when integration is connected.' : undefined)
}

export function Tabs({
  label,
  items,
  activeId,
  onChange,
  activation = 'automatic',
  idPrefix: idPrefixProp,
  variant = 'underline',
  children,
}: TabsProps): ReactElement {
  const generatedPrefix = useId()
  const idPrefix = idPrefixProp ?? generatedPrefix

  const activeIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === activeId)),
    [activeId, items],
  )

  const rovingOptions = {
    count: items.length,
    initialIndex: activeIndex,
    isDisabled: (index: number) => items[index]?.disabled === true,
    ...(activation === 'automatic'
      ? {
          onActivate: (index: number) => {
            const item = items[index]
            if (item !== undefined && item.disabled !== true) onChange(item.id)
          },
        }
      : {}),
  }

  const { setFocusIndex, getTabIndex, handleKeyDown } = useRovingTabIndex(rovingOptions)

  useEffect(() => {
    setFocusIndex(activeIndex)
  }, [activeIndex, setFocusIndex])

  const listClass =
    variant === 'enclosed'
      ? `${styles.list} ${styles.listEnclosed}`
      : styles.list

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className={listClass}
      >
        {items.map((item, index) => {
          const selected = item.id === activeId
          const tabClass = [
            styles.tab,
            'text-body',
            variant === 'underline' ? styles.tabUnderline : styles.tabEnclosed,
            selected ? styles.tabActive : '',
            item.disabled === true ? styles.tabDisabled : '',
          ]
            .filter(Boolean)
            .join(' ')

          const reason = disabledReason(item)

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${item.id}`}
              tabIndex={getTabIndex(index)}
              className={tabClass}
              disabled={item.disabled}
              title={reason}
              onClick={() => {
                if (item.disabled !== true) onChange(item.id)
              }}
              onKeyDown={(event) => {
                handleKeyDown(event, index)
                if (activation === 'manual' && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  if (item.disabled !== true) onChange(item.id)
                }
              }}
              onFocus={() => setFocusIndex(index)}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 ? (
                <span className={`${styles.count} text-caption`} aria-hidden="true">
                  {item.count}
                </span>
              ) : null}
              {item.count !== undefined && item.count > 0 ? (
                <VisuallyHidden>{`, ${item.count}`}</VisuallyHidden>
              ) : null}
              {reason !== undefined && item.disabled === true ? (
                <VisuallyHidden>. {reason}</VisuallyHidden>
              ) : null}
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}

export function TabPanel({
  tabId,
  idPrefix,
  active,
  children,
}: TabPanelProps): ReactElement | null {
  if (!active) return null

  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabId}`}
      aria-labelledby={`${idPrefix}-tab-${tabId}`}
      tabIndex={0}
      className={styles.panel}
    >
      {children}
    </div>
  )
}

export type TabsLoadingStripProps = {
  readonly count?: number
}

export function TabsLoadingStrip({ count = 3 }: TabsLoadingStripProps): ReactElement {
  return (
    <div className={styles.loadingStrip} aria-busy="true" aria-label="Loading tabs">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={styles.loadingPill}>
          <Skeleton region="tabs" shape="pill" width="100%" />
        </span>
      ))}
    </div>
  )
}
