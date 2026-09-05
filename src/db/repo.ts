import { and, count, desc, eq, gte, lt, or, sql } from 'drizzle-orm';

import { dayBounds, todayLocalDate } from '@/lib/date';

import { getDb, withTransaction } from './index';
import { DEFAULT_BUCKET_ID } from './seed';
import {
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  meta,
  roundHistory,
  roundWord,
  word,
} from './schema';

export type Bucket = { id: string; wordCount: number };

export type Progress = { round: number; pointer: number; startedAt: number };

export type WordRow = typeof word.$inferSelect;

export type RoundWordRow = { position: number; reached: boolean; flagged: boolean };

export type RoundHistoryRow = typeof roundHistory.$inferSelect;

export type DailyStatRow = typeof dailyStat.$inferSelect;

export type DailyPointerRow = typeof dailyPointer.$inferSelect;

export async function listBuckets(): Promise<Bucket[]> {
  const db = await getDb();
  return db.select().from(bucket).orderBy(desc(bucket.wordCount));
}

export async function getActiveBucketId(): Promise<string> {
  const db = await getDb();
  const row = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, 'activeBucketId'))
    .get();
  return row?.value ?? DEFAULT_BUCKET_ID;
}

export async function getProgress(bucketId: string): Promise<Progress> {
  const db = await getDb();
  const row = await db
    .select()
    .from(bucketProgress)
    .where(eq(bucketProgress.bucketId, bucketId))
    .get();
  return { round: row?.round ?? 1, pointer: row?.pointer ?? 0, startedAt: row?.startedAt ?? 0 };
}

export async function getWordCount(bucketId: string): Promise<number> {
  const db = await getDb();
  const row = await db
    .select({ wordCount: bucket.wordCount })
    .from(bucket)
    .where(eq(bucket.id, bucketId))
    .get();
  return row?.wordCount ?? 0;
}

export async function getWord(bucketId: string, position: number): Promise<WordRow | null> {
  const db = await getDb();
  const row = await db
    .select()
    .from(word)
    .where(and(eq(word.bucketId, bucketId), eq(word.position, position)))
    .get();
  return row ?? null;
}

export async function getWords(bucketId: string): Promise<WordRow[]> {
  const db = await getDb();
  return db.select().from(word).where(eq(word.bucketId, bucketId)).orderBy(word.position);
}

/**
 * Translates user input into a SQL LIKE pattern: `*` matches any run of
 * characters, `_` exactly one, everything else is literal. Without wildcards
 * the pattern stays a contains-match.
 */
function toLikePattern(query: string): string {
  let wildcard = false;
  let out = '';
  for (const ch of query) {
    if (ch === '*') {
      out += '%';
      wildcard = true;
    } else if (ch === '_') {
      out += '_';
      wildcard = true;
    } else if (ch === '\\') {
      out += '\\\\';
    } else if (ch === '%') {
      out += '\\%';
    } else {
      out += ch;
    }
  }
  return wildcard ? out : `%${out}%`;
}

export async function searchWords(
  bucketId: string,
  query: string,
  options: { matchMeaning?: boolean; limit?: number } = {},
): Promise<WordRow[]> {
  const { matchMeaning = false, limit = 100 } = options;
  const db = await getDb();
  const pattern = toLikePattern(query.trim());
  const textMatch = sql`lower(${word.text}) LIKE lower(${pattern}) ESCAPE '\\'`;
  const condition = matchMeaning
    ? or(textMatch, sql`lower(${word.meaning}) LIKE lower(${pattern}) ESCAPE '\\'`)
    : textMatch;
  return db
    .select()
    .from(word)
    .where(and(eq(word.bucketId, bucketId), condition))
    .orderBy(word.position)
    .limit(limit);
}

/**
 * Records a hand-settled card: marks the word reached in the current round and
 * moves the monotonic pointer forward. Only the settled position is marked —
 * positions skipped by a drag jump stay unreached. Starting a new round is
 * handled separately by startNextRound.
 */
export async function advancePointer(bucketId: string, position: number): Promise<Progress> {
  const db = await getDb();
  const before = await getProgress(bucketId);
  if (position <= before.pointer) return before;

  const wordCount = await getWordCount(bucketId);
  const flaggedRow = await db
    .select({ flagged: word.flagged })
    .from(word)
    .where(and(eq(word.bucketId, bucketId), eq(word.position, position)))
    .get();
  const settledAt = Date.now();
  const globalPosition = (before.round - 1) * wordCount + position;

  await withTransaction(async (tx) => {
    await tx
      .insert(roundWord)
      .values({
        bucketId,
        round: before.round,
        position,
        reached: true,
        flagged: flaggedRow?.flagged ?? false,
        reachedAt: settledAt,
      })
      .onConflictDoUpdate({
        target: [roundWord.bucketId, roundWord.round, roundWord.position],
        set: { reached: true, reachedAt: settledAt },
      });
    await tx
      .update(bucketProgress)
      .set({ pointer: position })
      .where(eq(bucketProgress.bucketId, bucketId));
    await tx
      .insert(dailyPointer)
      .values({ day: todayLocalDate(), bucketId, globalPosition })
      .onConflictDoUpdate({
        target: [dailyPointer.day, dailyPointer.bucketId],
        set: { globalPosition },
      });
  });

  return { ...before, pointer: position };
}

/** Moves to the next round after the previous one was fully walked through. */
export async function startNextRound(bucketId: string): Promise<Progress> {
  const db = await getDb();
  const before = await getProgress(bucketId);
  const wordCount = await getWordCount(bucketId);
  // Idempotent: only advance from a fully walked-through round, so a
  // duplicated settle on the round-end card cannot skip a round.
  if (before.pointer < wordCount) return before;
  const now = Date.now();

  await withTransaction(async (tx) => {
    await tx
      .insert(roundHistory)
      .values({
        bucketId,
        round: before.round,
        startedAt: before.startedAt > 0 ? before.startedAt : now,
        finishedAt: now,
      })
      .onConflictDoUpdate({
        target: [roundHistory.bucketId, roundHistory.round],
        set: { startedAt: before.startedAt > 0 ? before.startedAt : now, finishedAt: now },
      });
    await tx
      .update(bucketProgress)
      .set({ round: before.round + 1, pointer: 0, startedAt: now })
      .where(eq(bucketProgress.bucketId, bucketId));
  });

  return { round: before.round + 1, pointer: 0, startedAt: now };
}

/** Toggles the flag on a word and records it against the current round. */
export async function setFlag(
  bucketId: string,
  position: number,
  flagged: boolean,
): Promise<void> {
  const db = await getDb();
  const { round } = await getProgress(bucketId);

  await withTransaction(async (tx) => {
    await tx
      .update(word)
      .set({ flagged })
      .where(and(eq(word.bucketId, bucketId), eq(word.position, position)));
    if (flagged) {
      await tx
        .insert(roundWord)
        .values({ bucketId, round, position, reached: false, flagged: true })
        .onConflictDoUpdate({
          target: [roundWord.bucketId, roundWord.round, roundWord.position],
          set: { flagged: true },
        });
    } else {
      const row = await tx
        .select({ reached: roundWord.reached })
        .from(roundWord)
        .where(
          and(
            eq(roundWord.bucketId, bucketId),
            eq(roundWord.round, round),
            eq(roundWord.position, position),
          ),
        )
        .get();
      if (row && !row.reached) {
        await tx
          .delete(roundWord)
          .where(
            and(
              eq(roundWord.bucketId, bucketId),
              eq(roundWord.round, round),
              eq(roundWord.position, position),
            ),
          );
      } else if (row) {
        await tx
          .update(roundWord)
          .set({ flagged: false })
          .where(
            and(
              eq(roundWord.bucketId, bucketId),
              eq(roundWord.round, round),
              eq(roundWord.position, position),
            ),
          );
      }
    }
  });
}

export async function getFlaggedWords(bucketId: string): Promise<WordRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(word)
    .where(and(eq(word.bucketId, bucketId), eq(word.flagged, true)))
    .orderBy(word.position);
}

/** Words that were flagged during a specific round (historical snapshot). */
export async function getRoundFlaggedWords(bucketId: string, round: number): Promise<WordRow[]> {
  const db = await getDb();
  return db
    .select({
      bucketId: word.bucketId,
      position: word.position,
      text: word.text,
      ipa: word.ipa,
      meaning: word.meaning,
      forms: word.forms,
      flagged: word.flagged,
    })
    .from(word)
    .innerJoin(
      roundWord,
      and(eq(roundWord.bucketId, word.bucketId), eq(roundWord.position, word.position)),
    )
    .where(and(eq(word.bucketId, bucketId), eq(roundWord.round, round), eq(roundWord.flagged, true)))
    .orderBy(word.position);
}

/** Distinct words completed on a local day, across all buckets. */
export async function getWordsCompletedOn(day: string): Promise<WordRow[]> {
  const db = await getDb();
  const { start, end } = dayBounds(day);
  return db
    .selectDistinct({
      bucketId: word.bucketId,
      position: word.position,
      text: word.text,
      ipa: word.ipa,
      meaning: word.meaning,
      forms: word.forms,
      flagged: word.flagged,
    })
    .from(word)
    .innerJoin(
      roundWord,
      and(eq(roundWord.bucketId, word.bucketId), eq(roundWord.position, word.position)),
    )
    .where(and(gte(roundWord.reachedAt, start), lt(roundWord.reachedAt, end)))
    .orderBy(word.bucketId, word.position);
}

export async function countFlaggedWords(bucketId: string): Promise<number> {
  const db = await getDb();
  const row = await db
    .select({ n: count() })
    .from(word)
    .where(and(eq(word.bucketId, bucketId), eq(word.flagged, true)))
    .get();
  return row?.n ?? 0;
}

/** Green/red counts for the current round, matching the stats timelines. */
export async function getRoundFlagCounts(bucketId: string): Promise<{ green: number; red: number }> {
  const db = await getDb();
  const { round } = await getProgress(bucketId);
  const rows = await db
    .select({ reached: roundWord.reached, flagged: roundWord.flagged })
    .from(roundWord)
    .where(and(eq(roundWord.bucketId, bucketId), eq(roundWord.round, round)));
  let green = 0;
  let red = 0;
  for (const row of rows) {
    if (row.flagged) red += 1;
    else if (row.reached) green += 1;
  }
  return { green, red };
}

export async function getRoundHistory(bucketId: string): Promise<RoundHistoryRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(roundHistory)
    .where(eq(roundHistory.bucketId, bucketId))
    .orderBy(roundHistory.round);
}

export async function getRoundWords(bucketId: string, round: number): Promise<RoundWordRow[]> {
  const db = await getDb();
  return db
    .select({ position: roundWord.position, reached: roundWord.reached, flagged: roundWord.flagged })
    .from(roundWord)
    .where(and(eq(roundWord.bucketId, bucketId), eq(roundWord.round, round)))
    .orderBy(roundWord.position);
}

export async function addDailyTime(day: string, feedSeconds: number, appSeconds: number): Promise<void> {
  const db = await getDb();
  await db
    .insert(dailyStat)
    .values({ day, feedSeconds, appSeconds })
    .onConflictDoUpdate({
      target: dailyStat.day,
      set: {
        feedSeconds: sql`${dailyStat.feedSeconds} + excluded.feed_seconds`,
        appSeconds: sql`${dailyStat.appSeconds} + excluded.app_seconds`,
      },
    });
}

export async function listDailyStats(): Promise<DailyStatRow[]> {
  const db = await getDb();
  return db.select().from(dailyStat).orderBy(dailyStat.day);
}

export async function listDailyPointers(): Promise<DailyPointerRow[]> {
  const db = await getDb();
  return db.select().from(dailyPointer).orderBy(dailyPointer.day);
}

export async function getDailyStat(day: string): Promise<DailyStatRow | null> {
  const db = await getDb();
  const row = await db.select().from(dailyStat).where(eq(dailyStat.day, day)).get();
  return row ?? null;
}
