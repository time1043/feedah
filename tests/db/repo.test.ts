jest.mock('@/db/index', () => require('./harness').dbIndex());
jest.mock('@/db/seed', () => ({ DEFAULT_BUCKET_ID: '2050' }));

import { eq } from 'drizzle-orm';

import { getDb } from '@/db/index';
import {
  addDailyTime,
  advancePointer,
  clearReviewCursor,
  getActiveBucketId,
  getProgress,
  getReviewCursor,
  getRoundHistory,
  getRoundWords,
  getWordCount,
  getWords,
  getWordsCompletedOn,
  listDailyPointers,
  listDailyStats,
  recoverRoundStartedAt,
  saveReviewCursor,
  searchWords,
  setFlag,
  startNextRound,
} from '@/db/repo';
import { bucket, bucketProgress, dailyPointer, meta, roundWord, word } from '@/db/schema';
import { dayBounds } from '@/lib/date';

import { resetDb, seedBucket, seedWords } from './harness';

// jest.config.js pins TZ=UTC; the fake clock names the "today" the repo writes.
const TODAY = '2026-10-26';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  resetDb();
});

afterEach(() => {
  jest.useRealTimers();
});

async function setupBucket(wordCount = 3, bucketId = 'b') {
  const db = await getDb();
  await seedBucket(db, bucketId, wordCount);
  await seedWords(db, bucketId, wordCount);
  return db;
}

describe('advancePointer', () => {
  it('marks the settled position reached and moves the pointer', async () => {
    await setupBucket(3);
    const progress = await advancePointer('b', 2);
    expect(progress.pointer).toBe(2);
    expect(await getRoundWords('b', 1)).toEqual([{ position: 2, reached: true, flagged: false }]);
  });

  it('is monotonic: an earlier position changes nothing', async () => {
    await setupBucket(3);
    await advancePointer('b', 2);
    const before = await getProgress('b');
    const progress = await advancePointer('b', 1);
    expect(progress).toEqual(before);
    expect(await getRoundWords('b', 1)).toEqual([{ position: 2, reached: true, flagged: false }]);
  });

  it('records the round start on the first settle', async () => {
    const db = await setupBucket(3);
    expect((await getProgress('b')).startedAt).toBe(0);
    const progress = await advancePointer('b', 1);
    expect(progress.startedAt).toBeGreaterThan(0);
    const stored = (
      await db.select().from(bucketProgress).where(eq(bucketProgress.bucketId, 'b'))
    )[0];
    expect(stored.startedAt).toBe(progress.startedAt);
    expect(stored.progressUpdatedAt).toBeGreaterThan(0);
  });

  it('keeps positions skipped by a jump unreached', async () => {
    await setupBucket(3);
    await advancePointer('b', 1);
    await advancePointer('b', 3);
    expect(await getRoundWords('b', 1)).toEqual([
      { position: 1, reached: true, flagged: false },
      { position: 3, reached: true, flagged: false },
    ]);
  });

  it('writes the global position (round-1)*wordCount+position to daily_pointer', async () => {
    await setupBucket(3);
    await advancePointer('b', 3);
    let rows = await listDailyPointers();
    expect(rows).toEqual([
      expect.objectContaining({ day: TODAY, bucketId: 'b', globalPosition: 3 }),
    ]);
    await startNextRound('b');
    await advancePointer('b', 1);
    rows = await listDailyPointers();
    expect(rows.at(-1)?.globalPosition).toBe(4);
  });

  it('carries the flag onto the round_word row when settling a flagged word', async () => {
    await setupBucket(3);
    await setFlag('b', 2, true);
    await advancePointer('b', 2);
    expect(await getRoundWords('b', 1)).toEqual([{ position: 2, reached: true, flagged: true }]);
  });
});

describe('startNextRound', () => {
  it('refuses to advance before the round is fully walked', async () => {
    await setupBucket(3);
    await advancePointer('b', 1);
    const before = await getProgress('b');
    expect(await startNextRound('b')).toEqual(before);
    expect((await getProgress('b')).round).toBe(1);
    expect(await getRoundHistory('b')).toEqual([]);
  });

  it('records history and opens the next round', async () => {
    await setupBucket(3);
    const settled = await advancePointer('b', 3);
    const next = await startNextRound('b');
    expect(next).toMatchObject({ round: 2, pointer: 0 });
    expect(next.startedAt).toBeGreaterThan(0);
    const history = await getRoundHistory('b');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ round: 1, startedAt: settled.startedAt });
    expect(history[0].finishedAt).toBeGreaterThan(0);
  });

  it('is idempotent: a duplicated round-end settle cannot skip a round', async () => {
    await setupBucket(3);
    await advancePointer('b', 3);
    await advancePointer('b', 3);
    await startNextRound('b');
    await startNextRound('b');
    expect((await getProgress('b')).round).toBe(2);
    expect(await getRoundHistory('b')).toHaveLength(1);
  });
});

describe('setFlag', () => {
  it('flags a word and records it against the current round', async () => {
    await setupBucket(3);
    await setFlag('b', 2, true);
    const words = await getWords('b');
    expect(words[1]).toMatchObject({ position: 2, flagged: true });
    expect(await getRoundWords('b', 1)).toEqual([{ position: 2, reached: false, flagged: true }]);
  });

  it('keeps the round_word row of a reached word on unflag', async () => {
    await setupBucket(3);
    await advancePointer('b', 2);
    await setFlag('b', 2, true);
    await setFlag('b', 2, false);
    const words = await getWords('b');
    expect(words[1].flagged).toBe(false);
    expect(await getRoundWords('b', 1)).toEqual([{ position: 2, reached: true, flagged: false }]);
  });

  it('deletes the round_word row of an unreached word on unflag', async () => {
    await setupBucket(3);
    await setFlag('b', 1, true);
    await setFlag('b', 1, false);
    expect(await getRoundWords('b', 1)).toEqual([]);
    const words = await getWords('b');
    expect(words[0].flagged).toBe(false);
  });
});

describe('getWordsCompletedOn', () => {
  it('rebuilds the day from daily pointer deltas, wrapping across rounds', async () => {
    const db = await setupBucket(3);
    await db.insert(dailyPointer).values([
      { day: '2026-10-25', bucketId: 'b', globalPosition: 2 },
      { day: TODAY, bucketId: 'b', globalPosition: 4 },
    ]);
    const words = await getWordsCompletedOn(TODAY);
    // the day's gain (global 3..4) wraps to within-round positions {3, 1}
    expect(words.map((w) => w.position)).toEqual([1, 3]);
  });

  it('ignores a backwards pointer', async () => {
    const db = await setupBucket(3);
    await db.insert(dailyPointer).values([
      { day: '2026-10-25', bucketId: 'b', globalPosition: 10 },
      { day: TODAY, bucketId: 'b', globalPosition: 5 },
    ]);
    expect(await getWordsCompletedOn(TODAY)).toEqual([]);
  });

  it('skips buckets with no words', async () => {
    const db = await getDb();
    await db.insert(bucket).values({ id: 'empty', wordCount: 0 });
    await db.insert(dailyPointer).values({ day: TODAY, bucketId: 'empty', globalPosition: 5 });
    expect(await getWordsCompletedOn(TODAY)).toEqual([]);
  });
});

describe('review cursor', () => {
  it('keeps the high-water position and ignores non-positive writes', async () => {
    const key = 'day:2026-10-26';
    await saveReviewCursor(key, 5);
    expect(await getReviewCursor(key)).toBe(5);
    await saveReviewCursor(key, 3);
    await saveReviewCursor(key, 0);
    await saveReviewCursor(key, -2);
    expect(await getReviewCursor(key)).toBe(5);
    await clearReviewCursor(key);
    expect(await getReviewCursor(key)).toBe(0);
  });
});

describe('recoverRoundStartedAt', () => {
  it('uses the earliest reached word of the round', async () => {
    const db = await setupBucket(3);
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, reached: true, reachedAt: 200, updatedAt: 200 },
      { bucketId: 'b', round: 1, position: 2, reached: true, reachedAt: 100, updatedAt: 100 },
    ]);
    expect(await recoverRoundStartedAt('b', 1, 3)).toBe(100);
  });

  it('falls back to the first daily pointer that covers the round start', async () => {
    const db = await setupBucket(3);
    await db.insert(dailyPointer).values({ day: '2026-10-25', bucketId: 'b', globalPosition: 2 });
    expect(await recoverRoundStartedAt('b', 1, 3)).toBe(dayBounds('2026-10-25').start);
  });

  it('ignores reached words with a zero timestamp', async () => {
    const db = await setupBucket(3);
    await db.insert(roundWord).values({
      bucketId: 'b',
      round: 1,
      position: 1,
      reached: true,
      reachedAt: 0,
      updatedAt: 0,
    });
    expect(await recoverRoundStartedAt('b', 1, 3)).toBe(0);
  });

  it('returns 0 when nothing is recoverable', async () => {
    await setupBucket(3);
    expect(await recoverRoundStartedAt('b', 2, 3)).toBe(0);
  });
});

describe('searchWords', () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.insert(bucket).values({ id: 'b', wordCount: 6 });
    await db.insert(word).values([
      { bucketId: 'b', position: 1, text: 'terminal', forms: ['terminally'] },
      { bucketId: 'b', position: 2, text: 'water', forms: [] },
      {
        bucketId: 'b',
        position: 3,
        text: 'integrate',
        meaning: 'to combine into a whole',
        forms: [],
      },
      { bucketId: 'b', position: 4, text: 'scene', forms: [] },
      { bucketId: 'b', position: 5, text: 'sense', forms: [] },
      { bucketId: 'b', position: 6, text: 'donation', forms: ['donate', 'donates'] },
    ]);
  });

  it('contains-matches plain text, case-insensitively', async () => {
    expect((await searchWords('b', 'ter')).map((w) => w.position)).toEqual([1, 2]);
    expect((await searchWords('b', 'TER')).map((w) => w.position)).toEqual([1, 2]);
  });

  it('supports prefix, suffix and infix wildcards', async () => {
    expect((await searchWords('b', 'ter%')).map((w) => w.position)).toEqual([1]);
    expect((await searchWords('b', '%ter')).map((w) => w.position)).toEqual([2]);
    expect((await searchWords('b', 'w%r')).map((w) => w.position)).toEqual([2]);
    expect((await searchWords('b', 'w_ter')).map((w) => w.position)).toEqual([2]);
  });

  it('unions alternatives split by |', async () => {
    expect((await searchWords('b', 'scene|sense')).map((w) => w.position)).toEqual([4, 5]);
  });

  it('matches inflected forms and returns the headword', async () => {
    expect((await searchWords('b', 'donate')).map((w) => w.position)).toEqual([6]);
  });

  it('optionally scans meanings', async () => {
    expect(await searchWords('b', 'combin')).toEqual([]);
    expect(
      (await searchWords('b', 'combin', { matchMeaning: true })).map((w) => w.position),
    ).toEqual([3]);
  });

  it('respects the limit', async () => {
    expect((await searchWords('b', '%a%', { limit: 2 })).length).toBe(2);
  });
});

describe('addDailyTime', () => {
  it('sums seconds per day', async () => {
    await addDailyTime(TODAY, 30, 0);
    await addDailyTime(TODAY, 0, 45);
    await addDailyTime('2026-10-27', 10, 0);
    const stats = await listDailyStats();
    expect(stats.find((s) => s.day === TODAY)).toMatchObject({ feedSeconds: 30, appSeconds: 45 });
    expect(stats).toHaveLength(2);
  });
});

describe('defaults', () => {
  it('falls back to the bundled default bucket when meta is empty', async () => {
    expect(await getActiveBucketId()).toBe('2050');
    const db = await getDb();
    await db.insert(meta).values({ key: 'activeBucketId', value: '700' });
    expect(await getActiveBucketId()).toBe('700');
  });

  it('defaults progress for a bucket without rows', async () => {
    expect(await getProgress('missing')).toEqual({ round: 1, pointer: 0, startedAt: 0 });
    expect(await getWordCount('missing')).toBe(0);
  });
});

describe('cleanup', () => {
  it('deletes rows through the drizzle delete builder', async () => {
    const db = await setupBucket(3);
    await db.delete(word).where(eq(word.bucketId, 'b'));
    expect(await getWords('b')).toEqual([]);
  });
});
