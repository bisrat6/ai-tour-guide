import { useEffect, useState, type RefObject } from 'react'

import { effectTokens, semanticTokens } from '../tokens/semantic.ts'

const trackedVars: string[] = [
  ...semanticTokens.map((entry) => entry.cssVar),
  ...effectTokens.map((entry) => entry.cssVar),
]

/**
 * Reads the browser's computed value for every semantic token inside a plane
 * container, so the review surface reports what the page actually resolved
 * rather than what the token source claims.
 */
export function useComputedTokens(ref: RefObject<HTMLElement | null>): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const styles = getComputedStyle(element)
    const next: Record<string, string> = {}
    for (const name of trackedVars) next[name] = styles.getPropertyValue(name).trim()
    setValues(next)
  }, [ref])

  return values
}
