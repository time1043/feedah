// Matches a leading part-of-speech tag: n. / v. / adj. / prep. / conj. …
const POS_TAG = /^[a-z]+\./i

/**
 * Groups a meaning's "、"-separated senses by part of speech: a sense that
 * starts with a POS tag opens a new line, and any following bare senses join
 * it with "、" so one POS group stays together. Returns null when no break
 * is needed: the meaning is short, or every sense belongs to one group.
 *   "prep. 为了……、对于……、conj. 因为"
 *     -> ["prep. 为了……、对于……", "conj. 因为"]
 */
export function meaningLines(meaning: string): string[] | null {
  const senses = meaning
    .split('、')
    .map((sense) => sense.trim())
    .filter((sense) => sense.length > 0)
  if (senses.length < 3) return null
  const lines: string[] = []
  for (const sense of senses) {
    if (lines.length === 0 || POS_TAG.test(sense)) lines.push(sense)
    else lines[lines.length - 1] += `、${sense}`
  }
  return lines.length > 1 ? lines : null
}
