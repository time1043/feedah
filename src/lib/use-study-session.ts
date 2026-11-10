import { useFocusEffect } from 'expo-router'
import { useCallback, useReducer } from 'react'

import type { Drill } from '@/drills/contract'
import type { DeckWord } from '@/types/bucket'

import {
  completeRound,
  getProgress,
  getWordsWithRoundFlag,
  setRoundFlag,
  settleCard,
} from '@/db/repo/study-round'
import { clampProgress, countsOf, LOADING_SESSION, studyReducer } from '@/lib/study-session'

/**
 * Owns the study session state (reducer) and every db write the study
 * policy triggers. Timers, the deck handle and chrome stay in the screen.
 *
 * The reload on focus restarts the session's local state (answers/drafts are
 * session-local) while the probe (round/pointer) and the round's flags live in
 * the database and survive — killing the app mid-round resumes at the
 * frontier, with the same cards marked.
 */
export function useStudySession(bucketName: string, drill: Drill) {
  const [session, dispatch] = useReducer(studyReducer, LOADING_SESSION)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          // The round is what the flags are keyed by, so it is read first.
          const progress = await getProgress(bucketName)
          // The first element (the bucket exists) is ignored on purpose: an
          // unknown bucket simply has no words to study, and the empty deck is
          // inert (reachEnd refuses it) instead of writing a probe row that
          // would violate the foreign key.
          const [, rows] = await getWordsWithRoundFlag(bucketName, progress.round)
          if (!cancelled) {
            dispatch({
              type: 'loaded',
              words: rows,
              progress: clampProgress(progress, rows.length),
            })
            // The drill rebuilds its per-card private data (options, …) for
            // the fresh load; recycled cards must not reshuffle underneath.
            drill.prepare?.(rows)
          }
        } catch (error) {
          console.error('[study] session load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
      // The drill object is registry-stable: it never changes for a given id.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bucketName]),
  )

  const actions = {
    /** Settles onto card `index`: advances the probe unless browsing — the
     * db write happens only when the pointer actually moves. */
    settle: (index: number) => {
      if (session.status === 'ready' && !session.browsing && index > session.progress.pointer) {
        void settleCard(bucketName, index).catch((error) =>
          console.error('[study] settle failed', error),
        )
      }
      dispatch({ type: 'settled', index })
    },

    startBrowsing: () => dispatch({ type: 'browsingStarted' }),

    /** Leaves browsing and returns to the frontier (the screen also scrolls). */
    resume: () => dispatch({ type: 'resumed' }),

    /** Records an answer; auto-flags wrong picks when the mode says so. The
     * policy comes from the drill once the registry lands — until then,
     * neutral: no auto-flag, no auto-advance. A drill that does turn
     * autoFlag on must also write the round_flag row, or the mark lives only
     * on screen. */
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

    /**
     * Toggles the round's flag: the session flips it for the deck and the
     * round_flag row follows (insert or delete) — one write per tap, two
     * stores that say the same thing.
     */
    toggleFlag: (word: DeckWord) => {
      const round = session.status === 'ready' ? session.progress.round : 1
      dispatch({ type: 'flagToggled', position: word.position })
      void setRoundFlag(bucketName, round, word.position, !word.flagged).catch((error) =>
        console.error('[study] flag write failed', error),
      )
    },

    /**
     * The end page was reached. Returns false to veto the landing (browsing,
     * an empty bucket, or the round was not walked through); otherwise
     * completes the round in the database — the probe steps to the next
     * round, card 0 — and resets the session to match.
     */
    reachEnd: (): boolean => {
      if (session.status !== 'ready') return false
      if (session.words.length === 0) return false
      if (session.browsing || session.progress.pointer < session.words.length - 1) return false
      // Freeze the round's tallies before the reset wipes the answers — the
      // end page shows them for its whole linger.
      const { answered, correct } = countsOf(session)
      const now = Date.now()
      dispatch({ type: 'roundAdvanced', now, answered, correct })
      void completeRound(bucketName, now).catch((error) =>
        console.error('[study] round completion failed', error),
      )
      return true
    },
  }

  return { session, actions }
}
