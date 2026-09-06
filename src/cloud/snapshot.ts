import { gte } from 'drizzle-orm';

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

// The local state pushed to the cloud; field shapes match the `sync.push`
// mutation args exactly.
export type LocalSnapshot = {
  progress: {
    bucketId: string;
    round: number;
    pointer: number;
    startedAt: number;
    progressUpdatedAt: number;
  }[];
  roundWords: {
    bucketId: string;
    round: number;
    position: number;
    reached: boolean;
    flagged: boolean;
    reachedAt: number;
    updatedAt: number;
  }[];
  roundHistory: {
    bucketId: string;
    round: number;
    startedAt: number;
    finishedAt: number;
    updatedAt: number;
  }[];
  dailyStats: {
    day: string;
    feedSeconds: number;
    appSeconds: number;
    updatedAt: number;
  }[];
  dailyPointers: {
    day: string;
    bucketId: string;
    globalPosition: number;
    updatedAt: number;
  }[];
  wordFlags: {
    bucketId: string;
    position: number;
    flagged: boolean;
    flaggedAt: number;
  }[];
  meta: { key: string; value: string; updatedAt: number }[];
};

/** Reads every user-state row that the cloud mirror should see. */
export async function readLocalSnapshot(): Promise<LocalSnapshot> {
  const db = await getDb();
  const [progress, roundWords, history, stats, pointers, flags, metaRows] = await Promise.all([
    db.select().from(bucketProgress),
    db.select().from(roundWord),
    db.select().from(roundHistory),
    db.select().from(dailyStat),
    db.select().from(dailyPointer),
    // flaggedAt = 0 means the flag was never touched, so nothing to sync.
    db.select().from(word).where(gte(word.flaggedAt, 1)),
    db.select().from(meta),
  ]);

  return {
    progress: progress.map((row) => ({
      bucketId: row.bucketId,
      round: row.round,
      pointer: row.pointer,
      startedAt: row.startedAt,
      progressUpdatedAt: row.progressUpdatedAt,
    })),
    roundWords: roundWords.map((row) => ({
      bucketId: row.bucketId,
      round: row.round,
      position: row.position,
      reached: row.reached,
      flagged: row.flagged,
      reachedAt: row.reachedAt,
      updatedAt: row.updatedAt,
    })),
    roundHistory: history.map((row) => ({
      bucketId: row.bucketId,
      round: row.round,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      updatedAt: row.updatedAt,
    })),
    dailyStats: stats.map((row) => ({
      day: row.day,
      feedSeconds: row.feedSeconds,
      appSeconds: row.appSeconds,
      updatedAt: row.updatedAt,
    })),
    dailyPointers: pointers.map((row) => ({
      day: row.day,
      bucketId: row.bucketId,
      globalPosition: row.globalPosition,
      updatedAt: row.updatedAt,
    })),
    wordFlags: flags.map((row) => ({
      bucketId: row.bucketId,
      position: row.position,
      flagged: row.flagged,
      flaggedAt: row.flaggedAt,
    })),
    meta: metaRows.map((row) => ({ key: row.key, value: row.value, updatedAt: row.updatedAt })),
  };
}
