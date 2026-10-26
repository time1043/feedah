jest.mock('@/db/index', () => require('../db/harness').dbIndex());
jest.mock('@/db/seed', () => ({ DEFAULT_BUCKET_ID: '2050' }));

import { eq } from 'drizzle-orm';

import type { CloudState } from '@/cloud/mirror';

import { applyCloudState } from '@/cloud/mirror';
import { getDb } from '@/db/index';
import {
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  meta,
  roundHistory,
  roundWord,
  word,
} from '@/db/schema';

import { resetDb, seedBucket, seedWords } from '../db/harness';

beforeEach(() => {
  resetDb();
});

function cloudState(parts: Partial<CloudState>): CloudState {
  return {
    progress: [],
    roundWords: [],
    roundHistory: [],
    dailyStats: [],
    dailyPointers: [],
    wordFlags: [],
    meta: [],
    ...parts,
  };
}

const prog = (
  bucketId: string,
  round: number,
  pointer: number,
  startedAt: number,
  progressUpdatedAt: number,
) => ({ bucketId, round, pointer, startedAt, progressUpdatedAt });

const rwd = (
  bucketId: string,
  round: number,
  reached: number[],
  flagged: number[],
  updatedAt: number,
) => ({ bucketId, round, reached, flagged, updatedAt });

describe('progress merge', () => {
  it('inserts progress for an unseen bucket', async () => {
    const result = await applyCloudState(cloudState({ progress: [prog('b', 2, 1, 50, 60)] }));
    expect(result).toEqual({ changed: true, metaChanged: false });
    const db = await getDb();
    expect(await db.select().from(bucketProgress)).toEqual([
      { bucketId: 'b', round: 2, pointer: 1, startedAt: 50, progressUpdatedAt: 60 },
    ]);
  });

  it('takes pointer and startedAt from the higher round', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .update(bucketProgress)
      .set({ round: 1, pointer: 2, startedAt: 100, progressUpdatedAt: 100 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 2, 0, 200, 150)] }));
    expect((await db.select().from(bucketProgress))[0]).toEqual({
      bucketId: 'b',
      round: 2,
      pointer: 0,
      startedAt: 200,
      progressUpdatedAt: 150,
    });
  });

  it('never drags the pointer back to an older round', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .update(bucketProgress)
      .set({ round: 2, pointer: 0, startedAt: 200, progressUpdatedAt: 150 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 1, 5, 100, 999)] }));
    expect((await db.select().from(bucketProgress))[0]).toEqual({
      bucketId: 'b',
      round: 2,
      pointer: 0,
      startedAt: 200,
      progressUpdatedAt: 999,
    });
  });

  it('merges same-round pointers by max', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .update(bucketProgress)
      .set({ round: 1, pointer: 1, startedAt: 0, progressUpdatedAt: 10 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 1, 2, 0, 20)] }));
    expect((await db.select().from(bucketProgress))[0]).toMatchObject({
      round: 1,
      pointer: 2,
      progressUpdatedAt: 20,
    });
  });

  it('repairs a zero local startedAt from the cloud even when its stamp is older', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .update(bucketProgress)
      .set({ round: 1, pointer: 2, startedAt: 0, progressUpdatedAt: 10 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 1, 2, 50, 5)] }));
    expect((await db.select().from(bucketProgress))[0]).toMatchObject({
      startedAt: 50,
      progressUpdatedAt: 10,
    });
  });

  it('resolves same-round startedAt by progressUpdatedAt', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db
      .update(bucketProgress)
      .set({ round: 1, pointer: 1, startedAt: 100, progressUpdatedAt: 100 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 1, 1, 200, 200)] }));
    expect((await db.select().from(bucketProgress))[0].startedAt).toBe(200);
    await db
      .update(bucketProgress)
      .set({ startedAt: 100, progressUpdatedAt: 300 })
      .where(eq(bucketProgress.bucketId, 'b'));
    await applyCloudState(cloudState({ progress: [prog('b', 1, 1, 200, 200)] }));
    expect((await db.select().from(bucketProgress))[0].startedAt).toBe(100);
  });

  it('converges: applying the same cloud state twice changes nothing the second time', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await seedWords(db, 'b', 3);
    const cloud = cloudState({
      progress: [prog('b', 2, 1, 500, 500)],
      roundWords: [rwd('b', 2, [1], [], 500)],
      roundHistory: [{ bucketId: 'b', round: 1, startedAt: 100, finishedAt: 400, updatedAt: 400 }],
      dailyStats: [{ day: '2026-10-26', feedSeconds: 30, appSeconds: 0, updatedAt: 500 }],
      dailyPointers: [{ day: '2026-10-26', bucketId: 'b', globalPosition: 4, updatedAt: 500 }],
      wordFlags: [{ bucketId: 'b', position: 2, flagged: true, flaggedAt: 500 }],
      meta: [{ key: 'theme', value: 'dark', updatedAt: 500 }],
    });
    expect(await applyCloudState(cloud)).toEqual({ changed: true, metaChanged: true });
    expect(await applyCloudState(cloud)).toEqual({ changed: false, metaChanged: false });
  });
});

describe('roundWords merge', () => {
  it('expands a compact cloud doc into round_word rows', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await applyCloudState(cloudState({ roundWords: [rwd('b', 1, [1, 2], [3], 500)] }));
    const rows = await db.select().from(roundWord).orderBy(roundWord.position);
    expect(rows.map((r) => [r.position, r.reached, r.flagged])).toEqual([
      [1, true, false],
      [2, true, false],
      [3, false, true],
    ]);
    expect(rows[0].updatedAt).toBe(500);
  });

  it('union-merges with local rows and keeps their timestamps', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundWord).values({
      bucketId: 'b',
      round: 1,
      position: 1,
      reached: true,
      updatedAt: 10,
    });
    await applyCloudState(cloudState({ roundWords: [rwd('b', 1, [1, 2], [], 20)] }));
    const rows = await db.select().from(roundWord).orderBy(roundWord.position);
    expect(rows.find((r) => r.position === 1)).toMatchObject({ reached: true, updatedAt: 10 });
    expect(rows.find((r) => r.position === 2)).toMatchObject({ reached: true, updatedAt: 20 });
  });

  it('preserves local flags the cloud does not know about', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 5);
    await db.insert(roundWord).values({
      bucketId: 'b',
      round: 1,
      position: 5,
      reached: false,
      flagged: true,
      updatedAt: 10,
    });
    await applyCloudState(cloudState({ roundWords: [rwd('b', 1, [1], [], 20)] }));
    const rows = await db.select().from(roundWord).orderBy(roundWord.position);
    expect(rows.find((r) => r.position === 5)).toMatchObject({ flagged: true });
  });

  it('writes large rounds through the batched insert path', async () => {
    // 250 rows exceed one 100-row insert chunk; the batching exists to stay
    // under SQLite's bound-parameter limit (rebuilt with e1b1424).
    const db = await getDb();
    await seedBucket(db, 'big', 250);
    const reached = Array.from({ length: 250 }, (_, i) => i + 1);
    await applyCloudState(
      cloudState({
        roundWords: [
          rwd(
            'big',
            1,
            reached,
            reached.filter((p) => p % 10 === 0),
            500,
          ),
        ],
      }),
    );
    const rows = await db.select().from(roundWord).where(eq(roundWord.bucketId, 'big'));
    expect(rows).toHaveLength(250);
    expect(rows.find((r) => r.position === 10)).toMatchObject({ reached: true, flagged: true });
    expect(rows.find((r) => r.position === 1)).toMatchObject({ reached: true, flagged: false });
  });
});

describe('roundHistory merge', () => {
  it('recovers a zero startedAt from the cloud and keeps the later finish', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundHistory).values({
      bucketId: 'b',
      round: 1,
      startedAt: 0,
      finishedAt: 100,
      updatedAt: 100,
    });
    await applyCloudState(
      cloudState({
        roundHistory: [{ bucketId: 'b', round: 1, startedAt: 50, finishedAt: 90, updatedAt: 90 }],
      }),
    );
    expect((await db.select().from(roundHistory))[0]).toEqual({
      bucketId: 'b',
      round: 1,
      startedAt: 50,
      finishedAt: 100,
      updatedAt: 100,
    });
  });

  it('keeps local startedAt when the cloud has none', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundHistory).values({
      bucketId: 'b',
      round: 1,
      startedAt: 50,
      finishedAt: 100,
      updatedAt: 100,
    });
    await applyCloudState(
      cloudState({
        roundHistory: [{ bucketId: 'b', round: 1, startedAt: 0, finishedAt: 90, updatedAt: 90 }],
      }),
    );
    expect((await db.select().from(roundHistory))[0]).toMatchObject({ startedAt: 50 });
  });

  it('takes the earliest start of two positive values', async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await db.insert(roundHistory).values({
      bucketId: 'b',
      round: 1,
      startedAt: 100,
      finishedAt: 150,
      updatedAt: 150,
    });
    await applyCloudState(
      cloudState({
        roundHistory: [{ bucketId: 'b', round: 1, startedAt: 50, finishedAt: 120, updatedAt: 120 }],
      }),
    );
    expect((await db.select().from(roundHistory))[0]).toMatchObject({
      startedAt: 50,
      finishedAt: 150,
    });
  });
});

describe('dailyStats merge', () => {
  it('keeps the per-column max across devices', async () => {
    const db = await getDb();
    await db.insert(dailyStat).values({
      day: '2026-10-26',
      feedSeconds: 100,
      appSeconds: 50,
      updatedAt: 10,
    });
    await applyCloudState(
      cloudState({
        dailyStats: [{ day: '2026-10-26', feedSeconds: 80, appSeconds: 200, updatedAt: 5 }],
      }),
    );
    expect((await db.select().from(dailyStat))[0]).toEqual({
      day: '2026-10-26',
      feedSeconds: 100,
      appSeconds: 200,
      updatedAt: 10,
    });
  });

  it('inserts unseen days', async () => {
    await applyCloudState(
      cloudState({
        dailyStats: [{ day: '2026-10-26', feedSeconds: 10, appSeconds: 20, updatedAt: 5 }],
      }),
    );
    const db = await getDb();
    expect(await db.select().from(dailyStat)).toHaveLength(1);
  });
});

describe('dailyPointers merge', () => {
  it('keeps the higher global position and the newer stamp', async () => {
    const db = await getDb();
    await db
      .insert(dailyPointer)
      .values({ day: '2026-10-26', bucketId: 'b', globalPosition: 10, updatedAt: 5 });
    await applyCloudState(
      cloudState({
        dailyPointers: [{ day: '2026-10-26', bucketId: 'b', globalPosition: 4, updatedAt: 9 }],
      }),
    );
    expect((await db.select().from(dailyPointer))[0]).toEqual({
      day: '2026-10-26',
      bucketId: 'b',
      globalPosition: 10,
      updatedAt: 9,
    });
  });
});

describe('wordFlags merge', () => {
  beforeEach(async () => {
    const db = await getDb();
    await seedBucket(db, 'b', 3);
    await seedWords(db, 'b', 3);
  });

  it('applies a strictly newer flag (LWW)', async () => {
    const db = await getDb();
    await db.update(word).set({ flagged: true, flaggedAt: 100 }).where(eq(word.bucketId, 'b'));
    await applyCloudState(
      cloudState({ wordFlags: [{ bucketId: 'b', position: 1, flagged: true, flaggedAt: 200 }] }),
    );
    const row = (await db.select().from(word).where(eq(word.position, 1)))[0];
    expect(row).toMatchObject({ flagged: true, flaggedAt: 200 });
  });

  it('propagates an unflag and clears only the current round', async () => {
    const db = await getDb();
    await db.update(word).set({ flagged: true, flaggedAt: 100 }).where(eq(word.bucketId, 'b'));
    await db.insert(roundWord).values([
      { bucketId: 'b', round: 1, position: 1, flagged: true, updatedAt: 100 },
      { bucketId: 'b', round: 2, position: 1, flagged: true, updatedAt: 100 },
    ]);
    const result = await applyCloudState(
      cloudState({ wordFlags: [{ bucketId: 'b', position: 1, flagged: false, flaggedAt: 200 }] }),
    );
    expect(result).toEqual({ changed: true, metaChanged: false });
    expect((await db.select().from(word).where(eq(word.position, 1)))[0]).toMatchObject({
      flagged: false,
      flaggedAt: 200,
    });
    const rows = await db.select().from(roundWord);
    expect(rows.find((r) => r.round === 1)).toMatchObject({ flagged: false });
    // finished rounds are append-only history and stay untouched
    expect(rows.find((r) => r.round === 2)).toMatchObject({ flagged: true });
  });

  it('ignores clouds that are not strictly newer', async () => {
    const db = await getDb();
    await db.update(word).set({ flagged: true, flaggedAt: 200 }).where(eq(word.bucketId, 'b'));
    expect(
      await applyCloudState(
        cloudState({ wordFlags: [{ bucketId: 'b', position: 1, flagged: true, flaggedAt: 200 }] }),
      ),
    ).toEqual({ changed: false, metaChanged: false });
    expect(
      await applyCloudState(
        cloudState({ wordFlags: [{ bucketId: 'b', position: 1, flagged: true, flaggedAt: 50 }] }),
      ),
    ).toEqual({ changed: false, metaChanged: false });
  });

  it('skips positions without a local word row', async () => {
    expect(
      await applyCloudState(
        cloudState({ wordFlags: [{ bucketId: 'b', position: 99, flagged: true, flaggedAt: 999 }] }),
      ),
    ).toEqual({ changed: false, metaChanged: false });
  });

  it('updates the word but skips the round cleanup when progress is missing', async () => {
    const db = await getDb();
    await db.insert(bucket).values({ id: 'c', wordCount: 1 });
    await db.insert(word).values({ bucketId: 'c', position: 1, text: 'c1' });
    await db.update(word).set({ flagged: true, flaggedAt: 100 }).where(eq(word.bucketId, 'c'));
    await applyCloudState(
      cloudState({ wordFlags: [{ bucketId: 'c', position: 1, flagged: false, flaggedAt: 200 }] }),
    );
    expect((await db.select().from(word).where(eq(word.bucketId, 'c')))[0]).toMatchObject({
      flagged: false,
      flaggedAt: 200,
    });
  });
});

describe('meta merge', () => {
  it('inserts new keys and flags metaChanged', async () => {
    const result = await applyCloudState(
      cloudState({ meta: [{ key: 'theme', value: 'dark', updatedAt: 5 }] }),
    );
    expect(result).toEqual({ changed: true, metaChanged: true });
    const db = await getDb();
    expect(await db.select().from(meta)).toEqual([{ key: 'theme', value: 'dark', updatedAt: 5 }]);
  });

  it('bumps updatedAt for a same-value cloud row without flagging a change', async () => {
    const db = await getDb();
    await db.insert(meta).values({ key: 'theme', value: 'dark', updatedAt: 10 });
    const result = await applyCloudState(
      cloudState({ meta: [{ key: 'theme', value: 'dark', updatedAt: 20 }] }),
    );
    expect(result).toEqual({ changed: false, metaChanged: false });
    expect((await db.select().from(meta))[0]).toEqual({
      key: 'theme',
      value: 'dark',
      updatedAt: 20,
    });
  });

  it('applies newer values and flags metaChanged', async () => {
    const db = await getDb();
    await db.insert(meta).values({ key: 'theme', value: 'dark', updatedAt: 10 });
    const result = await applyCloudState(
      cloudState({ meta: [{ key: 'theme', value: 'light', updatedAt: 20 }] }),
    );
    expect(result).toEqual({ changed: true, metaChanged: true });
    expect((await db.select().from(meta))[0]).toMatchObject({ value: 'light' });
  });

  it('ignores older updates', async () => {
    const db = await getDb();
    await db.insert(meta).values({ key: 'theme', value: 'dark', updatedAt: 20 });
    const result = await applyCloudState(
      cloudState({ meta: [{ key: 'theme', value: 'light', updatedAt: 10 }] }),
    );
    expect(result).toEqual({ changed: false, metaChanged: false });
    expect((await db.select().from(meta))[0]).toMatchObject({ value: 'dark' });
  });

  it('reports nothing changed for an empty cloud state', async () => {
    expect(await applyCloudState(cloudState({}))).toEqual({ changed: false, metaChanged: false });
  });
});
