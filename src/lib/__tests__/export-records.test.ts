import type { LearningRecordRows } from '@/db/repo';

import { buildLearningRecords, compactRoundWords } from '@/lib/export-records';

function rows(): LearningRecordRows {
  return {
    buckets: [
      {
        bucket: {
          id: 'ko-basic',
          wordCount: 3,
          name: 'Korean Basics',
          kind: 'word',
          language: 'ko',
          source: 'custom',
          createdAt: 1,
        },
        words: [{ position: 1, text: '사과', ipa: '', meaning: '苹果', forms: [] }],
        progress: { round: 2, pointer: 1, startedAt: 10, progressUpdatedAt: 20 },
        history: [{ round: 1, startedAt: 5, finishedAt: 9 }],
        roundWords: [
          { round: 1, position: 1, reached: true, flagged: false, wrong: false },
          { round: 1, position: 2, reached: true, flagged: false, wrong: true },
          { round: 2, position: 1, reached: false, flagged: false, wrong: false }, // default row
          { round: 2, position: 3, reached: false, flagged: true, wrong: false },
        ],
        flags: [{ position: 3, flaggedAt: 15 }],
        dailyPointers: [{ day: '2026-10-25', globalPosition: 4 }],
      },
      {
        bucket: {
          id: '2050',
          wordCount: 2050,
          name: '2050',
          kind: 'word',
          language: 'en',
          source: 'builtin',
          createdAt: 0,
        },
        words: [],
        progress: { round: 1, pointer: 0, startedAt: 0, progressUpdatedAt: 0 },
        history: [],
        roundWords: [],
        flags: [],
        dailyPointers: [],
      },
    ],
    dailyStats: [{ day: '2026-10-25', feedSeconds: 600, appSeconds: 900 }],
  };
}

describe('compactRoundWords', () => {
  it('compacts per-round position arrays, sorted, dropping default rows', () => {
    const compact = compactRoundWords(rows().buckets[0].roundWords);
    expect(compact).toEqual([
      { round: 1, reached: [1, 2], flagged: [], wrong: [2] },
      { round: 2, reached: [], flagged: [3], wrong: [] },
    ]);
  });
});

describe('buildLearningRecords', () => {
  it('shapes the full export file', () => {
    const file = buildLearningRecords(rows(), { appVersion: '0.0.2', exportedAt: 123 });
    expect(file.schemaVersion).toBe(1);
    expect(file.app).toBe('feedah');
    expect(file.appVersion).toBe('0.0.2');
    expect(file.exportedAt).toBe(123);
    expect(file.dailyStat).toEqual([{ day: '2026-10-25', feedSeconds: 600, appSeconds: 900 }]);

    const [custom, builtin] = file.buckets;
    expect(custom.id).toBe('ko-basic');
    expect(custom.words).toEqual([
      { position: 1, text: '사과', ipa: '', meaning: '苹果', forms: [] },
    ]);
    expect(custom.roundWord).toEqual([
      { round: 1, reached: [1, 2], flagged: [], wrong: [2] },
      { round: 2, reached: [], flagged: [3], wrong: [] },
    ]);
    expect(custom.flags).toEqual([{ position: 3, flaggedAt: 15 }]);
    expect(custom.dailyPointer).toEqual([{ day: '2026-10-25', globalPosition: 4 }]);

    // Builtin word banks re-seed from the bundle; the export omits them.
    expect(builtin.words).toBeUndefined();
  });
});
