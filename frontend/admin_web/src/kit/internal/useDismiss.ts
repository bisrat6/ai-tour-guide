import { useEffect, type RefObject } from 'react'

export type UseDismissOptions = {
  readonly enabled: boolean
  readonly onDismiss: () => void
  readonly containerRef?: RefObject<HTMLElement | null>
  readonly dismissOnEscape?: boolean
  readonly dismissOnOutsidePress?: boolean
  readonly returnFocusTo?: RefObject<HTMLElement | null>
}

/** Escape, outside-press dismissal and optional focus return. */
export function useDismiss({
  enabled,
  onDismiss,
  containerRef,
  dismissOnEscape = true,
  dismissOnOutsidePress = false,
  returnFocusTo,
}: UseDismissOptions): void {
  useEffect(() => {
    if (!enabled) return

    function dismiss(): void {
      onDismiss()
      returnFocusTo?.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (dismissOnEscape && event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!dismissOnOutsidePress) return
      const container = containerRef?.current
      const target = event.target
      if (container !== undefined && container !== null && target instanceof Node) {
        if (!container.contains(target)) {
          dismiss()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [
    enabled,
    onDismiss,
    containerRef,
    dismissOnEscape,
    dismissOnOutsidePress,
    returnFocusTo,
  ])
}
