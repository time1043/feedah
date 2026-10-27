import { useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import { addFeedSecondsAtom } from '@/study/store'

/** Seconds accumulated in memory before being flushed to the store. */
const FLUSH_AFTER_SECONDS = 10

/**
 * Counts studying seconds while `enabled` (the screen is focused). Time
 * accumulates in memory and is flushed to the daily total in chunks — and
 * once more when the screen pauses or unmounts, so nothing is lost.
 */
export function useStudySeconds(enabled: boolean): void {
  const addSeconds = useSetAtom(addFeedSecondsAtom)
  const pending = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const flush = () => {
      if (pending.current > 0) {
        addSeconds({ seconds: pending.current })
        pending.current = 0
      }
    }
    const timer = setInterval(() => {
      pending.current += 1
      if (pending.current >= FLUSH_AFTER_SECONDS) flush()
    }, 1000)
    return () => {
      clearInterval(timer)
      flush()
    }
  }, [enabled, addSeconds])
}
