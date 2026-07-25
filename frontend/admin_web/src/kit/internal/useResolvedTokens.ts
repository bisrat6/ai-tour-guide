import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Reads computed custom-property values for canvas painting.
 * Extra deps are repaint triggers only (e.g. planeKey) — pass primitives, not
 * array literals, so the effect dependency list stays stable across renders.
 */
export function useResolvedTokens<K extends string>(
  ref: RefObject<HTMLElement | null>,
  names: readonly K[],
  ...deps: readonly unknown[]
): Readonly<Record<K, string>> {
  const [resolved, setResolved] = useState<Readonly<Record<K, string>>>(() => {
    const initial = {} as Record<K, string>
    for (const name of names) {
      initial[name] = ''
    }
    return initial
  })

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return

    function readTokens(): void {
      const style = getComputedStyle(element!)
      setResolved((prev) => {
        const next = {} as Record<K, string>
        let changed = false
        for (const name of names) {
          const value = style.getPropertyValue(name).trim()
          next[name] = value
          if (prev[name] !== value) {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }

    readTokens()
    void document.fonts.ready.then(readTokens)
  }, [ref, names, ...deps])

  return resolved
}
