import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

function focusAppRoot(): void {
  const root = document.getElementById('root')
  if (root === null) return
  if (root.tabIndex < 0) root.tabIndex = -1
  root.focus()
}

/** Returns focus after `open` becomes false — after unmount, per overlay contract. */
export function useReturnFocus(
  open: boolean,
  returnFocusTo?: RefObject<HTMLElement | null>,
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const active = document.activeElement
    previousFocusRef.current = active instanceof HTMLElement ? active : null
  }, [open])

  useLayoutEffect(() => {
    if (open) return

    const explicit = returnFocusTo?.current
    if (explicit !== null && explicit !== undefined && document.contains(explicit)) {
      explicit.focus()
      return
    }

    const previous = previousFocusRef.current
    if (previous !== null && document.contains(previous)) {
      previous.focus()
      return
    }

    focusAppRoot()
  }, [open, returnFocusTo])
}
