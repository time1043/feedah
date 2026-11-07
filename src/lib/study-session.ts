import type { Progress, WordWithFlag } from '@/db/repo'
import type { AnswerRecord, AnswerState } from '@/drills/contract'

/**
 * The study session's client state. The deck owns the on-screen index; this
 * owns everything the screen's policy needs: the word list, the probe,
 * browsing, per-card answers and drafts.
 */
export type StudySession =
  | { status: 'loading' }
  | {
      status: 'ready'
      words: WordWithFlag[]
      progress: Progress
      /** Free-swiping state entered by scrubbing; exited by Resume studying. */
      browsing: boolean
      /** Keyed by word position; an absent key is an unanswered card. */
      answers: Record<number, AnswerState>
      drafts: Record<number, string>
      /** The reducer's decision: this card auto-advances at `dueAt`. Cleared
       * by browsing, manual settles and round completion. */
      pendingAutoAdvance: { position: number; dueAt: number } | null
      /** The completed round's facts, frozen at roundAdvanced: the end page
       * renders them for its whole linger — live counts would read 0 of 0
       * and the live round number is already the NEXT one by the time the
       * page first paints. */
      endFacts: { answered: number; correct: number; nextRound: number } | null
    }

export const LOADING_SESSION: StudySession = { status: 'loading' }

export type StudyAction =
  | { type: 'loaded'; words: WordWithFlag[]; progress: Progress }
  | {
      type: 'answered'
      position: number
      correct: boolean
      picked?: string
      /** Wrong picks auto-flag the word when the mode says so. */
      autoFlag: boolean
      /** When a correct answer should slide to the next card. */
      autoAdvanceDueAt: number | null
    }
  | { type: 'skipped'; position: number }
  | { type: 'drafted'; position: number; value: string }
  | { type: 'flagToggled'; position: number }
  /** The user swiped onto card `index`. Advances the pointer unless
   * browsing (browse-mode swiping never moves it) or behind the frontier. */
  | { type: 'settled'; index: number }
  | { type: 'browsingStarted' }
  | { type: 'resumed' }
  /** Optimistic round reset; the DB transaction completes separately. */
  | {
      type: 'roundAdvanced'
      now: number
      /** The completed round's tallies, frozen into endFacts. */
      answered: number
      correct: number
    }
  | { type: 'roundWordsLoaded'; words: WordWithFlag[] }
  | { type: 'autoAdvanceDone' }

/**
 * Pure session reducer. Multi-field transitions (answer + auto-flag, round
 * reset) are atomic here — sequential object patches were the source of a
 * stale-overwrite bug.
 */
export function studyReducer(session: StudySession, action: StudyAction): StudySession {
  switch (action.type) {
    case 'loaded':
      // A focus reload intentionally restarts the session: answers and
      // drafts are session-local, the probe lives in the database.
      return {
        status: 'ready',
        words: action.words,
        progress: action.progress,
        browsing: false,
        answers: {},
        drafts: {},
        pendingAutoAdvance: null,
        endFacts: null,
      }
    case 'answered': {
      if (session.status !== 'ready') return session
      const { position, correct, picked, autoFlag, autoAdvanceDueAt } = action
      return {
        ...session,
        answers: { ...session.answers, [position]: { correct, picked } },
        // Auto-flag is a wrong-pick side effect: correct answers never flag.
        words:
          autoFlag && !correct
            ? session.words.map((w) => (w.position === position ? { ...w, flagged: true } : w))
            : session.words,
        pendingAutoAdvance:
          correct && autoAdvanceDueAt !== null
            ? { position, dueAt: autoAdvanceDueAt }
            : session.pendingAutoAdvance,
      }
    }
    case 'skipped': {
      if (session.status !== 'ready') return session
      return {
        ...session,
        answers: { ...session.answers, [action.position]: { skipped: true } },
      }
    }
    case 'drafted': {
      if (session.status !== 'ready') return session
      return {
        ...session,
        drafts: { ...session.drafts, [action.position]: action.value },
      }
    }
    case 'flagToggled': {
      if (session.status !== 'ready') return session
      return {
        ...session,
        words: session.words.map((w) =>
          w.position === action.position ? { ...w, flagged: !w.flagged } : w,
        ),
      }
    }
    case 'settled': {
      if (session.status !== 'ready') return session
      // Browsing never moves the pointer; neither does re-settling behind it.
      if (session.browsing || action.index <= session.progress.pointer) return session
      // The user moved on by hand: a pending auto-advance is obsolete.
      return {
        ...session,
        progress: { ...session.progress, pointer: action.index },
        pendingAutoAdvance: null,
      }
    }
    case 'browsingStarted': {
      if (session.status !== 'ready') return session
      // Scrubbing away makes a pending auto-advance obsolete.
      return { ...session, browsing: true, pendingAutoAdvance: null }
    }
    case 'resumed': {
      if (session.status !== 'ready') return session
      return { ...session, browsing: false, pendingAutoAdvance: null }
    }
    case 'roundAdvanced': {
      if (session.status !== 'ready') return session
      return {
        ...session,
        progress: {
          ...session.progress,
          round: session.progress.round + 1,
          pointer: 0,
          roundStartedAt: action.now,
        },
        answers: {},
        drafts: {},
        browsing: false,
        pendingAutoAdvance: null,
        endFacts: {
          answered: action.answered,
          correct: action.correct,
          // Frozen before the increment below: the round that starts in a
          // moment is the completed one's successor.
          nextRound: session.progress.round + 1,
        },
      }
    }
    case 'roundWordsLoaded': {
      if (session.status !== 'ready') return session
      return { ...session, words: action.words }
    }
    case 'autoAdvanceDone': {
      if (session.status !== 'ready') return session
      return { ...session, pendingAutoAdvance: null }
    }
  }
}

/** The card studying resumes from: the probe's pointer, clamped. */
export function frontierOf(session: StudySession): number {
  if (session.status !== 'ready') return 0
  return Math.min(session.progress.pointer, session.words.length)
}

/** End-page copy facts: how many cards were answered and how many right. */
export function countsOf(session: StudySession): { answered: number; correct: number } {
  if (session.status !== 'ready') return { answered: 0, correct: 0 }
  const list = Object.values(session.answers)
  const answered = list.filter((a): a is AnswerRecord => !('skipped' in a))
  return {
    answered: answered.length,
    correct: answered.filter((a) => a.correct).length,
  }
}
