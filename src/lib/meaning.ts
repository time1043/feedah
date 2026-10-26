import type { BucketKind } from '@/db/schema';

// Matches a leading part-of-speech tag: n. / v. / adj. / prep. / conj. …
const POS_TAG = /^[a-z]+\./i;

/**
 * Breaks a card's back text into lines.
 *
 * Word kind: groups a meaning's "、"-separated senses by part of speech — a
 * sense that starts with a POS tag opens a new line, and any following bare
 * senses join it with "、" so one POS group stays together.
 *   "prep. 为了……、对于……、conj. 因为"
 *     -> ["prep. 为了……、对于……", "conj. 因为"]
 *
 * QA kind: the back is answer and explanation folded together with a blank
 * line; paragraphs split on that blank line and never POS-group (the POS
 * regex is English-specific and question text would false-positive).
 *
 * Returns null when no break is needed: the text is short, single-grouped,
 * or a single paragraph.
 */
export function meaningLines(meaning: string, kind: BucketKind = 'word'): string[] | null {
  if (kind === 'qa') {
    const paras = meaning
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return paras.length > 1 ? paras : null;
  }
  const senses = meaning
    .split('、')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (senses.length < 3) return null;
  const lines: string[] = [];
  for (const sense of senses) {
    if (lines.length === 0 || POS_TAG.test(sense)) lines.push(sense);
    else lines[lines.length - 1] += `、${sense}`;
  }
  // One group (e.g. "n. 形式、表格、外观") needs no break.
  return lines.length > 1 ? lines : null;
}
