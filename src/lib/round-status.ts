export type RoundWordStatus = 'green' | 'red' | 'gray'

/**
 * One status per card of a round, in deck order: flagged cards are red (red
 * wins over everything), cards the pointer swept over are green, and cards
 * not reached yet in an unfinished round are gray. Exposure semantics: the
 * frontier is the probe's pointer, or the whole bucket once the round is
 * done. `round.flags` are card ordinals — 0-based indices into the bucket's
 * position-ordered word list, NOT word positions.
 */
export function roundStatuses(
  wordCount: number,
  round: { done: boolean; pointer: number; flags: number[] },
): RoundWordStatus[] {
  const flagSet = new Set(round.flags)
  const frontier = round.done ? wordCount : round.pointer
  return Array.from({ length: wordCount }, (_, ordinal) => {
    if (flagSet.has(ordinal)) return 'red'
    return ordinal < frontier ? 'green' : 'gray'
  })
}
