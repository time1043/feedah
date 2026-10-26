jest.mock('@/db/index', () => require('../db/harness').dbIndex());
jest.mock('@/db/seed', () => ({ DEFAULT_BUCKET_ID: '2050' }));

import { and, eq } from 'drizzle-orm';

import { readLocalSnapshot } from '@/cloud/snapshot';
import { getDb } from '@/db/index';
import {
  bucketProgress,
  dailyPointer,
  dailyStat,
  meta,
  roundHistory,
  roundWord,
  word,
} from '@/db/schema';

import { resetDb, seedBucket, seedWords } from '../db/harness';

// Real epoch values so recovery comparisons (recovered < finishedAt) behave
// like the runtime; TZ=UTC pins the local-midnight arithmetic.
const DAY25 = new Date(2026, 9, 25).getTime();
const DAY26 = new Date(2026, 9, 26).getTime();
const DAY27 = new Date(2026, 9, 27).getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetDb();
});

afterEach(() => {
  jest.useRealTimers();
});

async function seedFlaggedWord(bucketId: string, position: number, flaggedAt: number) {
  const db = await getDb();
  await db
    .update(word)
    .set({ flagged: true, flaggedAt })
    .where(and(eq(word.bucketId, bucketId), eq(word.position, position)));
}

describe('first sync (since = 0)', () => {
  it('captures rows whose version columns are still zero', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await seedWords(db, 'b', 3);
    await db
      .insert(roundHistory)
      .values({ bucketId: 'b', round: 1, startedAt: DAY25, finishedAt: DAY26, updatedAt: 0 });
    await db
      .insert(dailyStat)
      .values({ day: '2026-10-25', feedSeconds: 5, appSeconds: 1, updatedAt: 0 });
    await seedFlaggedWord('b', 1, 5);
    await db
      .insert(roundWord)
      .values({ bucketId: 'b', round: 1, position: 1, reached: true, updatedAt: 3 });

    const snap = await readLocalSnapshot();
    expect(snap.progress).toHaveLength(1);
    expect(snap.roundHistory).toHaveLength(1);
    expect(snap.dailyStats).toHaveLength(1);
    // flaggedAt = 0 means the flag was never touched — nothing to sync
    expect(snap.wordFlags).toEqual([{ bucketId: 'b', position: 1, flagged: true, flaggedAt: 5 }]);
    expect(snap.roundWords).toEqual([
      { bucketId: 'b', round: 1, reached: [1], flagged: [], updatedAt: 3 },
    ]);
    expect(snap.meta).toEqual([]);
  });
});

describe('watermark filtering (since > 0)', () => {
  it('pushes only rows touched since the watermark', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await seedWords(db, 'b', 3);
    await db.insert(dailyStat).values([
      { day: '2026-10-25', feedSeconds: 1, appSeconds: 0, updatedAt: 5 },
      { day: '2026-10-26', feedSeconds: 2, appSeconds: 0, updatedAt: 15 },
    ]);
    await db.insert(dailyPointer).values([
      { day: '2026-10-25', bucketId: 'b', globalPosition: 1, updatedAt: 5 },
      { day: '2026-10-26', bucketId: 'b', globalPosition: 2, updatedAt: 15 },
    ]);
    await db.insert(meta).values([
      { key: 'old', value: 'a', updatedAt: 5 },
      { key: 'fresh', value: 'b', updatedAt: 15 },
    ]);
    await db.insert(roundHistory).values([
      { bucketId: 'b', round: 1, startedAt: DAY25, finishedAt: DAY26, updatedAt: 5 },
      { bucketId: 'b', round: 2, startedAt: DAY25, finishedAt: DAY26, updatedAt: 15 },
      { bucketId: 'b', round: 3, startedAt: DAY25, finishedAt: DAY26, updatedAt: 0 },
    ]);
    await seedFlaggedWord('b', 1, 5);
    await seedFlaggedWord('b', 2, 15);
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, reached: true, updatedAt: 5 },
      { bucketId: 'b', round: 2, position: 1, reached: true, updatedAt: 15 },
    ]);

    const snap = await readLocalSnapshot(10);
    expect(snap.dailyStats.map((s) => s.day)).toEqual(['2026-10-26']);
    expect(snap.dailyPointers.map((p) => p.day)).toEqual(['2026-10-26']);
    expect(snap.meta.map((m) => m.key)).toEqual(['fresh']);
    // roundHistory also keeps zero-version rows so old bugs get pushed once
    expect(snap.roundHistory.map((h) => h.round).sort()).toEqual([2, 3]);
    expect(snap.wordFlags.map((f) => f.position)).toEqual([2]);
    expect(snap.roundWords.map((d) => d.round)).toEqual([2]);
  });
});

describe('progress startedAt recovery', () => {
  it('recovers and stores a zero startedAt from round word settlements', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await seedWords(db, 'b', 3);
    await db.update(bucketProgress).set({ pointer: 2 }).where(eq(bucketProgress.bucketId, 'b'));
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, reached: true, reachedAt: 200, updatedAt: 200 },
      { bucketId: 'b', round: 1, position: 2, reached: true, reachedAt: 100, updatedAt: 100 },
    ]);

    const snap = await readLocalSnapshot();
    expect(snap.progress[0]).toMatchObject({ startedAt: 100 });
    const stored = (
      await db.select().from(bucketProgress).where(eq(bucketProgress.bucketId, 'b'))
    )[0];
    expect(stored.startedAt).toBe(100);
    expect(stored.progressUpdatedAt).toBeGreaterThan(0);
  });

  it('leaves progress alone when the round has not started', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);

    const snap = await readLocalSnapshot();
    expect(snap.progress[0]).toMatchObject({ startedAt: 0 });
    expect((await db.select().from(bucketProgress))[0].progressUpdatedAt).toBe(0);
  });
});

describe('roundHistory repair', () => {
  it('recovers a missing startedAt from daily pointers', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .insert(dailyPointer)
      .values({ day: '2026-10-25', bucketId: 'b', globalPosition: 1, updatedAt: 5 });
    await db
      .insert(roundHistory)
      .values({ bucketId: 'b', round: 1, startedAt: 0, finishedAt: DAY26, updatedAt: 0 });

    const snap = await readLocalSnapshot();
    expect(snap.roundHistory[0]).toMatchObject({ startedAt: DAY25 });
    expect(snap.roundHistory[0].updatedAt).toBeGreaterThan(0);
    const stored = (await db.select().from(roundHistory).where(eq(roundHistory.round, 1)))[0];
    expect(stored.startedAt).toBe(DAY25);
  });

  it('repairs a startedAt that is not before finishedAt (old bug shape)', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .insert(dailyPointer)
      .values({ day: '2026-10-25', bucketId: 'b', globalPosition: 1, updatedAt: 5 });
    await db
      .insert(roundHistory)
      .values({ bucketId: 'b', round: 1, startedAt: DAY27, finishedAt: DAY26, updatedAt: 5 });

    const snap = await readLocalSnapshot();
    expect(snap.roundHistory[0]).toMatchObject({ startedAt: DAY25 });
  });

  it('leaves history alone when recovery is impossible', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .insert(roundHistory)
      .values({ bucketId: 'b', round: 1, startedAt: DAY27, finishedAt: DAY26, updatedAt: 5 });

    const snap = await readLocalSnapshot();
    expect(snap.roundHistory[0]).toMatchObject({ startedAt: DAY27, updatedAt: 5 });
  });

  it('backfills a zero updatedAt with the finished time', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .insert(roundHistory)
      .values({ bucketId: 'b', round: 1, startedAt: DAY25, finishedAt: DAY26, updatedAt: 0 });

    const snap = await readLocalSnapshot();
    expect(snap.roundHistory[0]).toMatchObject({ updatedAt: DAY26 });
  });
});

describe('round_word compression', () => {
  it('compacts rows into per-round docs with sorted position arrays', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, reached: true, updatedAt: 10 },
      { bucketId: 'b', round: 1, position: 2, flagged: true, updatedAt: 20 },
      {
        bucketId: 'b',
        round: 1,
        position: 3,
        reached: true,
        flagged: true,
        updatedAt: 15,
      },
      { bucketId: 'b', round: 2, position: 1, reached: true, updatedAt: 30 },
    ]);

    const snap = await readLocalSnapshot();
    const round1 = snap.roundWords.find((d) => d.round === 1);
    const round2 = snap.roundWords.find((d) => d.round === 2);
    expect(round1).toEqual({
      bucketId: 'b',
      round: 1,
      reached: [1, 3],
      flagged: [2, 3],
      updatedAt: 20,
    });
    expect(round2).toEqual({ bucketId: 'b', round: 2, reached: [1], flagged: [], updatedAt: 30 });
  });

  it('ships a touched round with only untouched rows as empty arrays', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundWord).values({
      bucketId: 'b',
      round: 1,
      position: 1,
      reached: false,
      flagged: false,
      updatedAt: 7,
    });

    const snap = await readLocalSnapshot();
    expect(snap.roundWords).toEqual([
      { bucketId: 'b', round: 1, reached: [], flagged: [], updatedAt: 7 },
    ]);
  });

  it('skips rounds untouched since the watermark', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, reached: true, updatedAt: 5 },
      { bucketId: 'b', round: 2, position: 1, reached: true, updatedAt: 15 },
    ]);

    const snap = await readLocalSnapshot(10);
    expect(snap.roundWords.map((d) => d.round)).toEqual([2]);
  });
});
