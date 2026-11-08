import { useRef } from 'react'

/**
 * Blocks double-taps from stacking two screens while a push settles: the
 * first call within the gap runs, the rest are dropped until it elapses.
 */
export function useNavGuard(gapMs = 500) {
  const navigating = useRef(false)
  return (push: () => void) => {
    if (navigating.current) return
    navigating.current = true
    push()
    setTimeout(() => {
      navigating.current = false
    }, gapMs)
  }
}
