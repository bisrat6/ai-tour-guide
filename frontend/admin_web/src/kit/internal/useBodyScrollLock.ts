import { useEffect } from 'react'

/** Locks document scroll while `locked` is true. */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
    }
  }, [locked])
}
