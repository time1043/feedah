export interface Word {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
}

export interface Bucket {
  name: string
  words: Word[]
}

/** A word as the deck consumes it: the static entry plus live flag state. */
export type DeckWord = Word & { flagged: boolean }
