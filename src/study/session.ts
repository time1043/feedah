import type { Progress, WordWithFlag } from '@/db/repo'
import type { AnswerRecord, AnswerState } from '@/study/types'

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
  | { type: 'roundAdvanced'; now: number }
  | { type: 'roundWordsLoaded'; words: WordWithFlag[] }

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
      }
    case 'answered': {
      if (session.status !== 'ready') return session
      const { position, correct, picked, autoFlag } = action
      return {
        ...session,
        answers: { ...session.answers, [position]: { correct, picked } },
        // Auto-flag is a wrong-pick side effect: correct answers never flag.
        words:
          autoFlag && !correct
            ? session.words.map((w) => (w.position === position ? { ...w, flagged: true } : w))
            : session.words,
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
      return { ...session, progress: { ...session.progress, pointer: action.index } }
    }
    case 'browsingStarted': {
      if (session.status !== 'ready') return session
      return { ...session, browsing: true }
    }
    case 'resumed': {
      if (session.status !== 'ready') return session
      return { ...session, browsing: false }
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
      }
    }
    case 'roundWordsLoaded': {
      if (session.status !== 'ready') return session
      return { ...session, words: action.words }
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
