export type RoundWordStatus = 'green' | 'red' | 'gray'

/**
 * One status per card of a round, in deck order: a flagged card is red (red
 * wins over everything), a card the walk reached is green, and a card not
 * reached yet in an unfinished round is gray.
 *
 * `round.swept` is a COUNT of reached cards and `round.flags` are card
 * ORDINALS — 0-based indices into the bucket's position-ordered word list,
 * never word positions. `swept` already encodes completion (a finished round
 * carries the whole list), so no `done` flag is needed here.
 */
export function roundStatuses(
  wordCount: number,
  round: { swept: number; flags: number[] },
): RoundWordStatus[] {
  const flagged = new Set(round.flags)
  return Array.from({ length: wordCount }, (_, ordinal) => {
    if (flagged.has(ordinal)) return 'red'
    return ordinal < round.swept ? 'green' : 'gray'
  })
}
