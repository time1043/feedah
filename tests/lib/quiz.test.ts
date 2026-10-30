import type { Word } from '@/types/word'

import { buildOptions, normalizeAnswer, pickDistractors } from '@/lib/quiz'

// Deterministic rand so shuffle outcomes are reproducible.
const makeRand = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

const word = (position: number, text: string, meaning: string): Word => ({
  position,
  word: text,
  ipa: '',
  meaning,
  forms: [],
  distractors: [],
})

describe('normalizeAnswer', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeAnswer('  Ice   Cream ')).toBe('ice cream')
  })

  it('straightens curly quotes and apostrophes', () => {
    expect(normalizeAnswer('isn’t')).toBe("isn't")
    expect(normalizeAnswer('‘quote’')).toBe("'quote'")
  })

  it('keeps hyphens, dots and internal punctuation exact', () => {
    expect(normalizeAnswer('A.M.')).toBe('a.m.')
    expect(normalizeAnswer('ice-cream')).toBe('ice-cream')
    expect(normalizeAnswer("y'all")).toBe("y'all")
  })
})

describe('pickDistractors', () => {
  const answer = word(1, 'optimistic', 'adj. 乐观的')
  const pool = [
    answer,
    word(2, 'positive', 'adj. 积极的'),
    word(3, 'negative', 'adj. 消极的'),
    word(4, 'pessimistic', 'adj. 悲观的'),
    word(5, 'optimist', 'adj. 乐观的'), // duplicate meaning — excluded
  ]

  it('fills up to three from the pool, excluding the answer and duplicate meanings', () => {
    const picked = pickDistractors(answer, [], pool, 3, makeRand([0, 0, 0]))
    expect(picked.map((d) => d.word).sort()).toEqual(['negative', 'pessimistic', 'positive'].sort())
  })

  it('uses curated distractors first and filters ones sharing the answer meaning', () => {
    const curated = [
      { word: 'hopeful', meaning: 'adj. 乐观的' }, // same meaning as answer — dropped
      { word: 'sanguine', meaning: 'adj. 乐天的' },
    ]
    const picked = pickDistractors(answer, curated, pool, 3, makeRand([0, 0, 0]))
    expect(picked.map((d) => d.word)).toContain('sanguine')
    expect(picked.map((d) => d.word)).not.toContain('hopeful')
    expect(picked).toHaveLength(3)
  })

  it('returns fewer than three when the bucket runs out', () => {
    const tiny = [answer, word(2, 'glum', 'adj. 闷闷不乐的')]
    const picked = pickDistractors(answer, [], tiny, 3, makeRand([0]))
    expect(picked).toHaveLength(1)
  })
})

describe('buildOptions', () => {
  it('shuffles the answer in with its distractors', () => {
    const answer = word(1, 'optimistic', 'adj. 乐观的')
    const distractors = [
      { word: 'positive', meaning: 'adj. 积极的' },
      { word: 'negative', meaning: 'adj. 消极的' },
      { word: 'pessimistic', meaning: 'adj. 悲观的' },
    ]
    const options = buildOptions(answer, distractors, makeRand([0, 0, 0]))
    expect(options).toHaveLength(4)
    expect(options.filter((o) => o.isCorrect)).toHaveLength(1)
    expect(new Set(options.map((o) => o.meaning)).size).toBe(4)
    expect(options.find((o) => o.isCorrect)?.meaning).toBe('adj. 乐观的')
  })
})
