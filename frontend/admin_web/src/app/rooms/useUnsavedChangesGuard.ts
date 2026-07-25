import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'

type UnsavedGuardResult = {
  readonly navigationConfirmOpen: boolean
  readonly stayOnPage: () => void
  readonly leavePage: () => void
  readonly allowNextNavigation: () => void
}

/**
 * Blocks in-app route transitions while dirty and exposes modal controls.
 * Also wires a browser unload prompt for tab close / hard reload.
 *
 * Requires a data router; `useBlocker` is unavailable under `<BrowserRouter>`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): UnsavedGuardResult {
  // A save or delete leaves the draft dirty relative to its baseline, so the
  // redirect that follows the write has to be waved through explicitly.
  const bypassOnceRef = useRef(false)

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (bypassOnceRef.current) {
          bypassOnceRef.current = false
          return false
        }
        return isDirty && currentLocation.pathname !== nextLocation.pathname
      },
      [isDirty],
    ),
  )
  const [navigationConfirmOpen, setNavigationConfirmOpen] = useState(false)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setNavigationConfirmOpen(true)
    }
  }, [blocker.state])

  useEffect(() => {
    if (!isDirty || typeof window === 'undefined') return
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isDirty])

  function stayOnPage(): void {
    setNavigationConfirmOpen(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  function leavePage(): void {
    setNavigationConfirmOpen(false)
    if (blocker.state === 'blocked') blocker.proceed()
  }

  function allowNextNavigation(): void {
    bypassOnceRef.current = true
  }

  return { navigationConfirmOpen, stayOnPage, leavePage, allowNextNavigation }
}
