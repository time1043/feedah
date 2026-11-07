import type { ReactNode } from 'react'

import type { DeckWord, Word } from '@/types/word'

/**
 * The drill id space is open: the built-ins are 'swipe' | 'quiz' | 'type',
 * a plugin may use any string. Ids are persisted — they end up in
 * answer_log.mode and in AsyncStorage ('feedah.study-mode') — so a plugin
 * id must be unique across the registry and stable across releases.
 */
export type DrillId = string

export interface AnswerRecord {
  correct: boolean
  /** The chosen option key (quiz drill) — lets the card highlight it. */
  picked?: string
}

/** Per-card answer state; undefined = not answered yet. */
export type AnswerState = AnswerRecord | { skipped: true }

/** Per-card render input, assembled by the mode screen. Cards hold no
 * session state of their own — FlatList recycles them. Date-walk screens
 * (day replay, flag review) pass entries enriched with their bucket and
 * round; single-bucket decks may omit them. */
export interface DrillCardProps {
  word: DeckWord & { bucketId?: string; round?: number }
  /** undefined = not answered yet (or the drill has no answers). */
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
 * A drill is "how a card is answered", not a separate progress: every drill
 * shares the probe, the round flags and the round-advance protocol, and the
 * mode it runs in (study/review/browse) decides what answering means for
 * the session. The abstraction lives at the screen layer — WordDeck stays a
 * dumb pager and only knows the renderCard slot.
 *
 * This interface is the drill plugin contract. Implement it in a
 * self-contained module (see src/drills/README.md), export it as the
 * module's default, and add it to the registry manifest.
 */
export interface Drill {
  id: DrillId
  /** Home chip + headerCenter drill label, e.g. Review(Swipe). */
  label: string
  /** Runs once per data load: rebuilds the drill's private per-card data
   * (e.g. shuffled options). All randomness lives here. Date-walk screens
   * pass bucket-enriched entries, so the bucket id may be present. */
  prepare?: (words: (Word & { bucketId?: string; round?: number })[]) => void
  renderCard: (props: DrillCardProps) => ReactNode
  /** The deck auto-speaks on open/settle/scrub. Typing must be false —
   * speaking the word would leak the answer. */
  speakOnSettle: boolean
  /** Whether the progress bar may be scrubbed (scrubbing flips the deck
   * into browse mode, which records nothing). */
  scrubbable: boolean
  /** Whether user gestures scroll the deck freely. Answer-gated drills are
   * false: the screen toggles scrollEnabled while the current card is
   * unanswered, so the only way forward is answering. */
  scrollable: boolean
  /** After a CORRECT answer the deck auto-advances after this many ms. */
  autoAdvanceMs?: number
  /** A wrong answer auto-flags the word (the user can unflag freely). */
  autoFlagOnWrong?: boolean
  /** End-page copy. nextRound is the round that starts after the linger.
   * The page renders title, then stats (when present), then note — one
   * line each, never a packed single line. */
  endCopy: (facts: { nextRound: number; total: number; correct: number; answered: number }) => {
    title: string
    /** The round's tally line, e.g. "4 of 4 correct" — absent when the
     * drill records no answers. */
    stats?: string
    /** The closing line, e.g. "Round 6 starts in a moment". */
    note: string
  }
}
