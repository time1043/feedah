import type { ReactNode } from 'react'

import type { DeckWord } from '@/types/word'

export type StudyModeId = 'swipe' | 'quiz' | 'type'

export interface AnswerRecord {
  correct: boolean
  /** The chosen option key (choice mode) — lets the card highlight it. */
  picked?: string
}

/** Per-card answer state; undefined = not answered yet. */
export type AnswerState = AnswerRecord | { skipped: true }

/** Per-card render input, assembled by the study screen. Cards hold no
 * session state of their own — FlatList recycles them. */
export interface StudyCardProps {
  word: DeckWord
  /** undefined = not answered yet (or the mode has no answers). */
  answered: AnswerState | undefined
  onAnswer: (correct: boolean, picked?: string) => void
  /** Reveal without recording an answer (typing's "show answer"). */
  onSkip: () => void
  /** The card's draft text (typing input), lifted to the screen so it
   * survives FlatList recycling. */
  draft?: string
  onDraft?: (value: string) => void
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * A study mode is "how a round is swiped", not a separate progress: every
 * mode shares the probe, the round flags and the round-advance protocol.
 * The abstraction lives at the screen layer — WordDeck stays a dumb pager
 * and only knows the renderCard slot.
 */
export interface StudyMode {
  id: StudyModeId
  /** Home chip + headerCenter label. */
  label: string
  /** Runs once per data load: rebuilds the mode's private per-card data
   * (e.g. shuffled options). All randomness lives here. */
  prepare?: (words: DeckWord[]) => void
  renderCard: (props: StudyCardProps) => ReactNode
  /** The deck auto-speaks on open/settle/scrub. Typing must be false —
   * speaking the word would leak the answer. */
  speakOnSettle: boolean
  /** Whether the progress bar may be scrubbed (scrubbing flips the deck
   * into browse mode, which records nothing). */
  scrubbable: boolean
  /** Whether user gestures scroll the deck freely. Answer-gated modes are
   * false: the screen toggles scrollEnabled while the current card is
   * unanswered, so the only way forward is answering. */
  scrollable: boolean
  /** After a CORRECT answer the deck auto-advances after this many ms. */
  autoAdvanceMs?: number
  /** A wrong answer auto-flags the word (the user can unflag freely). */
  autoFlagOnWrong?: boolean
  /** End-page copy. nextRound is the round that starts after the linger. */
  endCopy: (facts: { nextRound: number; total: number; correct: number; answered: number }) => {
    title: string
    subtitle: string
  }
}
