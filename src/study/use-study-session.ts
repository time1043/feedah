import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useReducer } from 'react'

import type { Drill } from '@/drill/types'
import type { StudyAction, StudySession } from '@/study/session'
import type { DeckWord } from '@/types/word'

import {
  completeRound,
  getProgress,
  settleCard,
  getWordsWithRoundFlag,
  recordAnswer,
  setRoundFlag,
  type WordWithFlag,
} from '@/db/repo'
import { LOADING_SESSION, studyReducer } from '@/study/session'

/**
 * Owns the study session state (reducer) and every db write the policy
 * triggers. Timers, the deck handle and chrome stay in the screen.
 */
export function useStudySession(bucket: string, drill: Drill) {
  const [session, dispatch] = useReducer(studyReducer, LOADING_SESSION)

  // Reloads on every focus: a review pushed on top may have re-flagged words.
  // The reload restarts the session (answers/drafts are session-local).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const progress = await getProgress(bucket)
        const words = await getWordsWithRoundFlag(bucket, progress.round)
        if (cancelled) return
        dispatch({ type: 'loaded', words, progress })
        drill.prepare?.(words)
      })()
      return () => {
        cancelled = true
      }
    }, [bucket, drill]),
  )

  const actions = {
    /** Settles onto card `index`: advances the probe unless browsing. */
    settle: (index: number) => {
      dispatch({ type: 'settled', index })
      // Browse-mode swiping never moves the probe — same rule as the
      // reducer; settleCard's own monotonic guard does the rest.
      if (session.status !== 'ready' || session.browsing) return
      if (index > session.progress.pointer) void settleCard(bucket, index)
    },

    startBrowsing: () => dispatch({ type: 'browsingStarted' }),

    /** Leaves browsing and returns to the frontier (the screen also scrolls). */
    resume: () => dispatch({ type: 'resumed' }),

    /** Records an answer; auto-flags wrong picks when the mode says so. */
    answer: (word: DeckWord, correct: boolean, picked?: string) => {
      dispatch({
        type: 'answered',
        position: word.position,
        correct,
        picked,
        autoFlag: drill.autoFlagOnWrong ?? false,
        autoAdvanceDueAt: drill.autoAdvanceMs ? Date.now() + drill.autoAdvanceMs : null,
      })
      void recordAnswer({
        bucketId: bucket,
        round: session.status === 'ready' ? session.progress.round : 1,
        position: word.position,
        mode: drill.id,
        correct,
      })
      if (!correct && (drill.autoFlagOnWrong ?? false)) {
        void setRoundFlag(
          bucket,
          session.status === 'ready' ? session.progress.round : 1,
          word.position,
          true,
        )
      }
    },

    skip: (word: DeckWord) => dispatch({ type: 'skipped', position: word.position }),

    /** The pending auto-advance was executed (or obsoleted) by the screen. */
    autoAdvanceDone: () => dispatch({ type: 'autoAdvanceDone' }),

    draft: (word: DeckWord, value: string) =>
      dispatch({ type: 'drafted', position: word.position, value }),

    toggleFlag: (word: DeckWord) => {
      dispatch({ type: 'flagToggled', position: word.position })
      void setRoundFlag(
        bucket,
        session.status === 'ready' ? session.progress.round : 1,
        word.position,
        !word.flagged,
      )
    },

    /**
     * The end page was reached. Returns false to veto the landing (browsing,
     * or the round was not walked through); otherwise completes the round
     * and reloads the carried word list.
     */
    reachEnd: (): boolean => {
      if (session.status !== 'ready') return false
      if (session.browsing || session.progress.pointer < session.words.length - 1) return false
      const nextRound = session.progress.round + 1
      dispatch({ type: 'roundAdvanced', now: Date.now() })
      void (async () => {
        // The reload must wait for the advance transaction: it carries the
        // finished round's flags into the new one (回显).
        await completeRound(bucket)
        const fresh: WordWithFlag[] = await getWordsWithRoundFlag(bucket, nextRound)
        dispatch({ type: 'roundWordsLoaded', words: fresh })
        drill.prepare?.(fresh)
      })()
      return true
    },
  }

  return { session, actions }
}
