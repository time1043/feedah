import { useFocusEffect } from 'expo-router'
import { useCallback, useReducer } from 'react'

import type { DeckWord } from '@/types/bucket'

import { getWordsByBucket } from '@/db/repo/bucket-word'
import { completeRound, getProgress, settleCard } from '@/db/repo/study-round'
import { clampProgress, countsOf, LOADING_SESSION, studyReducer } from '@/lib/study-session'

/**
 * Owns the study session state (reducer) and every db write the study
 * policy triggers. Timers, the deck handle and chrome stay in the screen.
 *
 * The reload on focus restarts the session's local state (answers/drafts are
 * session-local) while the probe (round/pointer) lives in the database and
 * survives — killing the app mid-round resumes at the frontier.
 *
 * Flags are a later feature and are deliberately NOT part of this: they
 * start clear on every load and stay session-local, so the probe's
 * persistence is not entangled with their table.
 */
export function useStudySession(bucketName: string) {
  const [session, dispatch] = useReducer(studyReducer, LOADING_SESSION)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          // The tuple's first element (the bucket exists) is ignored on
          // purpose: an unknown bucket simply has no words to study.
          const [[, rows], progress] = await Promise.all([
            getWordsByBucket(bucketName),
            getProgress(bucketName),
          ])
          // An unknown bucket has no words and nothing to settle; the empty
          // deck is inert (reachEnd refuses it) instead of writing a probe
          // row that would violate the foreign key.
          const words: DeckWord[] = rows.map((row) => ({ ...row, flagged: false }))
          if (!cancelled) {
            dispatch({ type: 'loaded', words, progress: clampProgress(progress, words.length) })
          }
        } catch (error) {
          console.error('[study] session load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
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

    /**
     * Toggles the round's flag. Frontend-only for now: the mark lives on the
     * session's words, so it survives browsing and round advances but not a
     * reload.
     *
     * The gap for the next commit is right here — the round_flag write
     * (`setRoundFlag(bucketName, session.progress.round, position, !flagged)`)
     * and, above, a load path that reads the round's flags instead of
     * hard-coding `flagged: false`.
     */
    toggleFlag: (word: DeckWord) => {
      dispatch({ type: 'flagToggled', position: word.position })
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
