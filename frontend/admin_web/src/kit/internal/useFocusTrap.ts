import { useEffect, type RefObject } from 'react'

import { getTabbables } from './getTabbables.ts'

/** Keeps Tab / Shift+Tab inside `containerRef` while `active` is true. */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (container === null) return

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Tab') return

      const tabbables = getTabbables(container!)
      if (tabbables.length === 0) {
        event.preventDefault()
        return
      }

      const first = tabbables[0]!
      const last = tabbables[tabbables.length - 1]!
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || !container!.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}
