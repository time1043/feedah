import { useFocusEffect } from 'expo-router'
import { useCallback, useReducer } from 'react'

import type { DeckWord } from '@/types/bucket'

import { countsOf, LOADING_SESSION, studyReducer, type Progress } from '@/lib/study-session'
import { findBucketByName } from '@/mock/bucket'

/**
 * Owns the study session state (reducer). The mock-stage twin of the drizzle
 * hook: words come straight from the mock bucket, every policy write stays
 * in memory, and each focus restarts the probe at round 1 — the db arrives
 * later and only changes where words/progress come from and where writes go.
 * Timers, the deck handle and chrome stay in the screen.
 */
export function useStudySession(bucketName: string) {
  const [session, dispatch] = useReducer(studyReducer, LOADING_SESSION)

  // Reloads on every focus: a later db-backed review may have re-flagged
  // words. The reload restarts the session (answers/drafts are session-local).
  useFocusEffect(
    useCallback(() => {
      const words: DeckWord[] = findBucketByName(bucketName).words.map((word) => ({
        ...word,
        flagged: false,
      }))
      const progress: Progress = { round: 1, pointer: 0, roundStartedAt: 0 }
      dispatch({ type: 'loaded', words, progress })
    }, [bucketName]),
  )

  const actions = {
    /** Settles onto card `index`: advances the probe unless browsing. */
    settle: (index: number) => {
      dispatch({ type: 'settled', index })
    },

    startBrowsing: () => dispatch({ type: 'browsingStarted' }),

    /** Leaves browsing and returns to the frontier (the screen also scrolls). */
    resume: () => dispatch({ type: 'resumed' }),

    /** Records an answer; auto-flags wrong picks when the mode says so. The
     * policy comes from the drill once the registry lands — until then,
     * neutral: no auto-flag, no auto-advance. */
    answer: (word: DeckWord, correct: boolean, picked?: string) => {
      dispatch({
        type: 'answered',
        position: word.position,
        correct,
        picked,
        autoFlag: false,
        autoAdvanceDueAt: null,
      })
    },

    skip: (word: DeckWord) => dispatch({ type: 'skipped', position: word.position }),

    /** The pending auto-advance was executed (or obsoleted) by the screen. */
    autoAdvanceDone: () => dispatch({ type: 'autoAdvanceDone' }),

    draft: (word: DeckWord, value: string) =>
      dispatch({ type: 'drafted', position: word.position, value }),

    toggleFlag: (word: DeckWord) => {
      dispatch({ type: 'flagToggled', position: word.position })
    },

    /**
     * The end page was reached. Returns false to veto the landing (browsing,
     * or the round was not walked through); otherwise resets the probe for
     * the next round. The words stay in place: their in-memory flags already
     * carry the finished round's marks into the next one.
     */
    reachEnd: (): boolean => {
      if (session.status !== 'ready') return false
      if (session.browsing || session.progress.pointer < session.words.length - 1) return false
      // Freeze the round's tallies before the reset wipes the answers — the
      // end page shows them for its whole linger.
      const { answered, correct } = countsOf(session)
      dispatch({ type: 'roundAdvanced', now: Date.now(), answered, correct })
      return true
    },
  }

  return { session, actions }
}
