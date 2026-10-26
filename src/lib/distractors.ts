import type { WordRow } from '@/db/repo';
import type { BucketKind } from '@/db/schema';

// mulberry32: tiny seedable PRNG, plenty for shuffling quiz options.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: stable string -> 32-bit seed.
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The short text shown as a quiz option. QA backs fold the explanation in
 * after a blank line; an option must be the bare answer or every wrong option
 * would leak its explanation.
 */
export function optionText(meaning: string, kind: BucketKind): string {
  if (kind === 'qa') {
    const answer = meaning.split(/\n{2,}/)[0] ?? '';
    return answer.trim();
  }
  return meaning.trim();
}

/**
 * Builds the option list for a quiz card: `count` distinct wrong options
 * sampled from the bucket's own pool (a Korean bucket draws Korean
 * distractors — pools never cross buckets), plus the correct one, all
 * shuffled with the same seed.
 *
 * Deterministic per (bucket, round, position): React Compiler forbids
 * memoization, so the card re-derives its options on every render, and an
 * unseeded sample would reshuffle mid-interaction. Seeding with the round
 * keeps the options different across rounds — repetition with variation.
 *
 * Candidates need a non-empty option text distinct from every already-picked
 * one and from the correct answer; a small pool yields fewer options rather
 * than fake answers.
 */
export function buildQuizOptions(
  correct: Pick<WordRow, 'bucketId' | 'position' | 'meaning'>,
  pool: WordRow[],
  kind: BucketKind,
  count = 3,
  round = 0,
): { text: string; correct: boolean }[] {
  const answer = optionText(correct.meaning, kind);
  const taken = new Set([answer]);
  const candidates: string[] = [];
  for (const item of pool) {
    if (item.position === correct.position) continue;
    const back = optionText(item.meaning, kind);
    if (back.length === 0 || taken.has(back)) continue;
    taken.add(back);
    candidates.push(back);
  }
  const rng = mulberry32(hashString(`${correct.bucketId}:${round}:${correct.position}`));
  const distractors: string[] = [];
  while (distractors.length < count && candidates.length > 0) {
    const index = Math.floor(rng() * candidates.length);
    distractors.push(candidates[index]);
    candidates.splice(index, 1);
  }
  const options = [
    { text: answer, correct: true },
    ...distractors.map((text) => ({ text, correct: false })),
  ];
  // Fisher-Yates on the same rng: correct-answer placement is stable per
  // render and varies across rounds just like the distractor sample.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}
