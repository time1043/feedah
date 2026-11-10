export type RoundWordStatus = 'green' | 'gray'

/**
 * One status per card of a round, in deck order: the cards the walk reached
 * are green, the rest gray. `swept` is a COUNT of reached cards — not a word
 * position (positions are the deck's business).
 *
 * Flags will paint some cards red when they land; the red/green/gray sweep of
 * the reference implementation arrives with their table, not before.
 */
export function roundStatuses(wordCount: number, swept: number): RoundWordStatus[] {
  return Array.from({ length: wordCount }, (_, ordinal) => (ordinal < swept ? 'green' : 'gray'))
}
