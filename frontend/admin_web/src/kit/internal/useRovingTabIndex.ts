import { useCallback, useState, type KeyboardEvent } from 'react'

export type UseRovingTabIndexOptions = {
  readonly count: number
  readonly initialIndex?: number
  readonly loop?: boolean
  readonly orientation?: 'horizontal' | 'vertical'
  readonly isDisabled?: (index: number) => boolean
  readonly onActivate?: (index: number) => void
}

export type UseRovingTabIndexResult = {
  readonly activeIndex: number
  /** Moves focus highlight without firing onActivate. */
  readonly setFocusIndex: (index: number) => void
  /** Moves focus and fires onActivate when supplied. */
  readonly setActiveIndex: (index: number) => void
  readonly getTabIndex: (index: number) => 0 | -1
  readonly handleKeyDown: (event: KeyboardEvent, index: number) => void
}

function isDisabledAt(
  index: number,
  isDisabled: ((index: number) => boolean) | undefined,
): boolean {
  return isDisabled?.(index) ?? false
}

function nextEnabledIndex(
  from: number,
  delta: number,
  count: number,
  loop: boolean,
  isDisabled: ((index: number) => boolean) | undefined,
): number {
  if (count === 0) return 0

  let index = from
  for (let step = 0; step < count; step += 1) {
    index += delta
    if (index < 0) {
      if (!loop) return from
      index = count - 1
    }
    if (index >= count) {
      if (!loop) return from
      index = 0
    }
    if (!isDisabledAt(index, isDisabled)) return index
  }

  return from
}

/** Roving tabindex for tablists, toolbars and series toggles. */
export function useRovingTabIndex({
  count,
  initialIndex = 0,
  loop = true,
  orientation = 'horizontal',
  isDisabled,
  onActivate,
}: UseRovingTabIndexOptions): UseRovingTabIndexResult {
  const [activeIndex, setActiveIndexState] = useState(initialIndex)

  const setFocusIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= count) return
      if (isDisabledAt(index, isDisabled)) return
      setActiveIndexState(index)
    },
    [count, isDisabled],
  )

  const setActiveIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= count) return
      if (isDisabledAt(index, isDisabled)) return
      setActiveIndexState(index)
      onActivate?.(index)
    },
    [count, isDisabled, onActivate],
  )

  const getTabIndex = useCallback(
    (index: number): 0 | -1 => (index === activeIndex ? 0 : -1),
    [activeIndex],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, index: number) => {
      const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
      const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'

      if (event.key === 'Home') {
        event.preventDefault()
        const first = nextEnabledIndex(0, 0, count, loop, isDisabled)
        setActiveIndex(first)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        const last = nextEnabledIndex(count - 1, 0, count, loop, isDisabled)
        setActiveIndex(last)
        return
      }

      if (event.key === prevKey) {
        event.preventDefault()
        const next = nextEnabledIndex(index, -1, count, loop, isDisabled)
        setActiveIndex(next)
        return
      }

      if (event.key === nextKey) {
        event.preventDefault()
        const next = nextEnabledIndex(index, 1, count, loop, isDisabled)
        setActiveIndex(next)
      }
    },
    [count, isDisabled, loop, orientation, setActiveIndex],
  )

  return {
    activeIndex,
    setFocusIndex,
    setActiveIndex,
    getTabIndex,
    handleKeyDown,
  }
}
