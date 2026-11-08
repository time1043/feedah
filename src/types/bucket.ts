/** A curated confusable for the multiple-choice mode. */
export interface Distractor {
  word: string
  meaning: string
}

/** A word card */
export interface Word {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
  distractors?: Distractor[]
}

/** A word as the deck consumes it: the static entry plus live flag state. */
export type DeckWord = Word & { flagged: boolean }

/**
 * A named word list. The mock-data container until the drizzle schema
 * replaces it; then buckets become rows and this type dissolves.
 */
export interface Bucket {
  name: string
  words: Word[]
}
