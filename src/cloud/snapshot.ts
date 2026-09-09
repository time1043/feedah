import { and, gt, gte } from 'drizzle-orm';

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
    reached: number[];
    flagged: number[];
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

/**
 * Reads the user-state rows that changed since `since` (a sync watermark, 0 =
 * first sync / full snapshot). Each table is filtered by its own version column
 * so an unchanged row costs nothing to push. `round_word` is grouped from only
 * the per-word rows updated since `since`, so an untouched round is skipped
 * entirely.
 */
export async function readLocalSnapshot(since = 0): Promise<LocalSnapshot> {
  const db = await getDb();
  // `since` of 0 means "everything" — pass `undefined` as the WHERE clause so a
  // bootstrap still captures rows whose version column is legitimately 0 (e.g. a
  // freshly seeded bucket whose progressUpdatedAt has never been bumped).
  const sinceSince = since > 0 ? since : undefined;
  const [
    progress,
    history,
    stats,
    pointers,
    flags,
    metaRows,
  ] = await Promise.all([
    db.select().from(bucketProgress).where(sinceSince ? gt(bucketProgress.progressUpdatedAt, sinceSince) : undefined),
    db.select().from(roundHistory).where(sinceSince ? gt(roundHistory.updatedAt, sinceSince) : undefined),
    db.select().from(dailyStat).where(sinceSince ? gt(dailyStat.updatedAt, sinceSince) : undefined),
    db.select().from(dailyPointer).where(sinceSince ? gt(dailyPointer.updatedAt, sinceSince) : undefined),
    // flaggedAt = 0 means the flag was never touched, so nothing to sync.
    db
      .select()
      .from(word)
      .where(
        sinceSince
          ? and(gte(word.flaggedAt, 1), gt(word.flaggedAt, sinceSince))
          : gte(word.flaggedAt, 1),
      ),
    db.select().from(meta).where(sinceSince ? gt(meta.updatedAt, sinceSince) : undefined),
  ]);
  // `round_word` is per-word locally but ships to the cloud as one compact doc
  // per round: only the positions that differ from the default (unreached,
  // unflagged) are kept, as two position arrays. Read only the rows touched
  // since `since`; rounds with no recent change are skipped.
  const roundWordRows = await db
    .select()
    .from(roundWord)
    .where(sinceSince ? gt(roundWord.updatedAt, sinceSince) : undefined);
  const byRound = new Map<
    string,
    { bucketId: string; round: number; reached: Set<number>; flagged: Set<number>; updatedAt: number }
  >();
  for (const r of roundWordRows) {
    const key = `${r.bucketId}|${r.round}`;
    let agg = byRound.get(key);
    if (!agg) {
      agg = { bucketId: r.bucketId, round: r.round, reached: new Set(), flagged: new Set(), updatedAt: 0 };
      byRound.set(key, agg);
    }
    if (r.reached) agg.reached.add(r.position);
    if (r.flagged) agg.flagged.add(r.position);
    if (r.updatedAt > agg.updatedAt) agg.updatedAt = r.updatedAt;
  }
  const roundWords = Array.from(byRound.values()).map((a) => ({
    bucketId: a.bucketId,
    round: a.round,
    reached: Array.from(a.reached).sort((x, y) => x - y),
    flagged: Array.from(a.flagged).sort((x, y) => x - y),
    updatedAt: a.updatedAt,
  }));

  return {
    progress: progress.map((row) => ({
      bucketId: row.bucketId,
      round: row.round,
      pointer: row.pointer,
      startedAt: row.startedAt,
      progressUpdatedAt: row.progressUpdatedAt,
    })),
    roundWords,
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
