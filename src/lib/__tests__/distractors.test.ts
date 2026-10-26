import type { WordRow } from '@/db/repo';

import { buildQuizOptions, optionText } from '@/lib/distractors';

function word(position: number, text: string, meaning: string): WordRow {
  return {
    bucketId: 'b',
    position,
    text,
    ipa: '',
    meaning,
    forms: [],
    flagged: false,
    flaggedAt: 0,
  } as WordRow;
}

const pool = [
  word(1, 'apple', '苹果'),
  word(2, 'banana', '香蕉'),
  word(3, 'cherry', '樱桃'),
  word(4, 'durian', '榴莲'),
  word(5, 'elder', '接骨木'),
];

describe('buildQuizOptions', () => {
  it('returns the correct answer plus three distinct distractors', () => {
    const options = buildQuizOptions(pool[0], pool, 'word', 3, 1);
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.correct)).toHaveLength(1);
    expect(new Set(options.map((o) => o.text)).size).toBe(4);
    expect(options.find((o) => o.correct)?.text).toBe('苹果');
  });

  it('is deterministic per round+position and varies across rounds', () => {
    const a = buildQuizOptions(pool[0], pool, 'word', 3, 1);
    const a2 = buildQuizOptions(pool[0], pool, 'word', 3, 1);
    expect(a).toEqual(a2);
    // The distractor sample differs (5 candidates choose 3): at least the
    // option order must differ between rounds.
    const b = buildQuizOptions(pool[0], pool, 'word', 3, 2);
    expect(JSON.stringify(a.map((o) => o.text))).not.toBe(JSON.stringify(b.map((o) => o.text)));
  });

  it('never offers the correct answer as a distractor', () => {
    for (const item of pool) {
      const options = buildQuizOptions(item, pool, 'word', 3, 7);
      expect(options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('yields fewer options when the pool is small instead of faking', () => {
    const tiny = [pool[0], word(2, 'b', 'B')];
    const options = buildQuizOptions(tiny[0], tiny, 'word', 3, 1);
    expect(options).toHaveLength(2);
  });

  it('uses bare answers for qa decks (no explanation leakage)', () => {
    const qaPool = [
      word(1, 'Q1', 'A1\n\n因为 X'),
      word(2, 'Q2', 'A2\n\n因为 Y'),
      word(3, 'Q3', 'A3\n\n因为 Z'),
      word(4, 'Q4', 'A4\n\n因为 W'),
    ];
    const options = buildQuizOptions(qaPool[0], qaPool, 'qa', 3, 1);
    expect(options.map((o) => o.text)).not.toContain('A1\n\n因为 X');
    expect(options.every((o) => !o.text.includes('\n'))).toBe(true);
  });
});

describe('optionText', () => {
  it('keeps word backs whole and strips qa explanations', () => {
    expect(optionText('n. 苹果、水果', 'word')).toBe('n. 苹果、水果');
    expect(optionText('A1\n\n因为 X', 'qa')).toBe('A1');
  });
});
