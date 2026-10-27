import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { flushUsage, pauseStudyUsage, startStudyUsage } from '@/db/usage'

/**
 * Feeds the daily study-time metric from a deck screen (feed/review): time
 * accrues only while the screen is focused AND the app is active —
 * backgrounding pauses it, otherwise the whole background span would be
 * credited on the next tick.
 */
export function useStudyUsage(): void {
  const focusedRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true
      startStudyUsage()
      return () => {
        focusedRef.current = false
        pauseStudyUsage()
        void flushUsage()
      }
    }, []),
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (focusedRef.current) startStudyUsage()
      } else {
        pauseStudyUsage()
        void flushUsage()
      }
    })
    return () => subscription.remove()
  }, [])
}
