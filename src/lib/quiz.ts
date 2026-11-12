import type { Distractor, Word } from '@/types/bucket'

export type QuizOption = { key: string; meaning: string; word: string; isCorrect: boolean }

/**
 * Typing answers: trim → NFC → lowercase → curly quotes straightened →
 * internal whitespace collapsed. Hyphens, apostrophes and abbreviation dots
 * stay exact — misspelling one IS a spelling mistake, that is the point of
 * the mode. Both the typed input and the expected word go through this.
 */
export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘‛`]/g, "'")
    .replace(/\s+/g, ' ')
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Tops the curated distractors up to `count` with random bucket words. The
 * answer itself and any entry sharing the answer's meaning are excluded —
 * two identical meanings would make the question unanswerable. Returns at
 * most `count`, fewer only when the bucket runs out of candidates.
 */
export function pickDistractors(
  correct: Word,
  curated: Distractor[],
  pool: Word[],
  count = 3,
  rand: () => number = Math.random,
): Distractor[] {
  const answerMeaning = correct.meaning.trim()
  const seen = new Set([answerMeaning])
  const picked: Distractor[] = []
  for (const distractor of shuffle(curated, rand)) {
    const meaning = distractor.meaning.trim()
    if (seen.has(meaning)) continue
    seen.add(meaning)
    picked.push(distractor)
    if (picked.length === count) return picked
  }
  for (const candidate of shuffle(pool, rand)) {
    if (candidate.position === correct.position) continue
    const meaning = candidate.meaning.trim()
    if (seen.has(meaning)) continue
    seen.add(meaning)
    picked.push({ word: candidate.word, meaning: candidate.meaning })
    if (picked.length === count) return picked
  }
  return picked
}

/** The answer plus its distractors, shuffled into display order. Each entry
 * carries its word: the reveal names what every option actually was, so the
 * confusable pairs teach themselves. */
export function buildOptions(
  correct: Word,
  distractors: Distractor[],
  rand: () => number = Math.random,
): QuizOption[] {
  return shuffle(
    [
      { key: 'correct', meaning: correct.meaning, word: correct.word, isCorrect: true },
      ...distractors.map((d, i) => ({
        key: `d${i}`,
        meaning: d.meaning,
        word: d.word,
        isCorrect: false,
      })),
    ],
    rand,
  )
}
