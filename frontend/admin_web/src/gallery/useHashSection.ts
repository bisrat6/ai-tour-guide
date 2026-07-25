import { useCallback, useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function getHashSnapshot(): string {
  return window.location.hash.slice(1)
}

function getServerHashSnapshot(): string {
  return ''
}

/** Hash-based section selection without a router. */
export function useHashSection(fallback: string): [string, (next: string) => void] {
  const hash = useSyncExternalStore(subscribe, getHashSnapshot, getServerHashSnapshot)
  const section = hash.length > 0 ? hash : fallback

  const setSection = useCallback((next: string) => {
    window.location.hash = next
  }, [])

  return [section, setSection]
}
