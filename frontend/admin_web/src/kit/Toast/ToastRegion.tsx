import type { ReactElement } from 'react'
import { useEffect, useRef } from 'react'

import styles from './Toast.module.css'

import { Button } from '../Button/Button.tsx'
import { CrossIcon } from '../internal/CrossIcon.tsx'
import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import type { StatusMarker } from '../types.ts'
import type { Toast, ToastRegionProps, ToastTone } from './Toast.types.ts'

const MARKER: Readonly<Record<ToastTone, StatusMarker>> = {
  success: 'dot',
  danger: 'cross',
  neutral: 'dash',
}

const MARK_CLASS: Readonly<Record<ToastTone, string>> = {
  success: styles.markSuccess,
  danger: styles.markDanger,
  neutral: styles.markNeutral,
}

function defaultDuration(toast: Toast): number | 'persist' {
  if (toast.duration !== undefined) return toast.duration
  if (toast.tone === 'danger') return 'persist'
  return 6000
}

type ToastItemProps = {
  readonly toast: Toast
  readonly onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps): ReactElement {
  const regionRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const remainingRef = useRef<number>(0)
  const startedRef = useRef<number>(0)

  const duration = defaultDuration(toast)
  const hasAction = toast.action !== undefined
  const liveRole = toast.tone === 'danger' ? 'alert' : 'status'
  const liveMode = toast.tone === 'danger' ? 'assertive' : 'polite'

  useEffect(() => {
    if (duration === 'persist' || hasAction) return

    const startTimer = (ms: number) => {
      startedRef.current = Date.now()
      remainingRef.current = ms
      timerRef.current = window.setTimeout(() => onDismiss(toast.id), ms)
    }

    startTimer(duration)

    const node = regionRef.current
    if (node === null) return

    const pause = () => {
      if (timerRef.current === null) return
      window.clearTimeout(timerRef.current)
      timerRef.current = null
      remainingRef.current -= Date.now() - startedRef.current
    }

    const resume = () => {
      if (timerRef.current !== null || remainingRef.current <= 0) return
      startTimer(remainingRef.current)
    }

    node.addEventListener('pointerenter', pause)
    node.addEventListener('pointerleave', resume)
    node.addEventListener('focusin', pause)
    node.addEventListener('focusout', resume)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      node.removeEventListener('pointerenter', pause)
      node.removeEventListener('pointerleave', resume)
      node.removeEventListener('focusin', pause)
      node.removeEventListener('focusout', resume)
    }
  }, [duration, hasAction, onDismiss, toast.id])

  return (
    <div ref={regionRef} role={liveRole} aria-live={liveMode} className={styles.toast}>
      <span className={`${styles.mark} ${MARK_CLASS[toast.tone]}`} aria-hidden="true">
        <StatusMarkerGlyph marker={MARKER[toast.tone]} size={12} />
      </span>
      <div className={styles.content}>
        <p className={`${styles.message} text-body`}>{toast.message}</p>
        {toast.detail !== undefined ? (
          <p className={`${styles.detail} text-caption`}>{toast.detail}</p>
        ) : null}
        {toast.action !== undefined ? (
          <div className={styles.actions}>
            <Button tone="ghost" compact onClick={toast.action.onAct}>
              {toast.action.label}
            </Button>
          </div>
        ) : null}
      </div>
      <div className={styles.controls}>
        <Button
          tone="ghost"
          iconOnly
          label="Dismiss"
          icon={<CrossIcon />}
          onClick={() => onDismiss(toast.id)}
        />
      </div>
    </div>
  )
}

/** Fixed notification stack — never steals focus on show. */
export function ToastRegion({
  toasts,
  onDismiss,
  placement = 'bottom-end',
  max = 3,
}: ToastRegionProps): ReactElement {
  const regionRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const visible = toasts.slice(-max)

  useEffect(() => {
    const region = regionRef.current
    if (region === null) return

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      if (!region!.contains(document.activeElement)) return

      event.preventDefault()
      const targetId = visible[visible.length - 1]?.id
      if (targetId !== undefined) onDismiss(targetId)

      if (visible.length <= 1) {
        previousFocusRef.current?.focus()
      }
    }

    region.addEventListener('keydown', handleKeyDown)
    return () => region.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss, visible])

  useEffect(() => {
    if (visible.length > 0 && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement
    }
  }, [visible.length])

  const placementClass = placement === 'dock' ? styles.dock : styles.bottomEnd

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label="Notifications"
      className={`${styles.region} ${placementClass}`}
    >
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
