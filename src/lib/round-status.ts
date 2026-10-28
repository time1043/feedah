export type RoundWordStatus = 'green' | 'red' | 'gray'

/**
 * One status per word of a round, in position order: flagged words are red
 * (red wins over everything), words the pointer swept over are green, and
 * words not reached yet in an unfinished round are gray. Exposure semantics:
 * the frontier is the probe's pointer, or the whole bucket once the round is
 * done.
 */
export function roundStatuses(
  wordCount: number,
  round: { done: boolean; pointer: number; flags: number[] },
): RoundWordStatus[] {
  const flagSet = new Set(round.flags)
  const frontier = round.done ? wordCount : round.pointer
  return Array.from({ length: wordCount }, (_, i) => {
    const position = i + 1
    if (flagSet.has(position)) return 'red'
    return position <= frontier ? 'green' : 'gray'
  })
}
