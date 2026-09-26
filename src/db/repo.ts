import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { todayLocalDate } from '@/lib/date';

import { getDb, withTransaction } from './index';
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
import { DEFAULT_BUCKET_ID } from './seed';

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
 * Translates user input into a SQL LIKE pattern, matching SQL semantics:
 *   %  any run of zero or more characters
 *   _  exactly one character
 * Only % and _ are treated as wildcards; any other character is literal.
 * A query with no wildcard characters is wrapped as a contains-match (%query%),
 * so a plain word search still finds substrings. Examples: `ter%` matches words
 * starting with ter, `%ter` ending with ter, `%ter%` containing ter, `wo%rd`
 * exactly starting with wo and ending with rd.
 */
function toLikePattern(query: string): string {
  let out = '';
  let hasWildcard = false;
  for (const ch of query) {
    if (ch === '%') {
      out += '%';
      hasWildcard = true;
    } else if (ch === '_') {
      out += '_';
      hasWildcard = true;
    } else if (ch === '\\') {
      out += '\\\\';
    } else {
      out += ch;
    }
  }
  return hasWildcard ? out : `%${out}%`;
}

export async function searchWords(
  bucketId: string,
  query: string,
  options: { matchMeaning?: boolean; limit?: number } = {},
): Promise<WordRow[]> {
  const { matchMeaning = false, limit = 100 } = options;
  const db = await getDb();
  // `|` splits the query into alternatives whose results are unioned, so two
  // similar words that a single pattern cannot describe can be looked up at
  // once (`scene|sense`, `sc_ne|s_nse`). Each alternative keeps the %/_ rules.
  const trimmed = query.trim();
  const alternatives = trimmed
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const parts = alternatives.length > 0 ? alternatives : [trimmed];
  const conditions = parts.map((part) => {
    const pattern = toLikePattern(part);
    // Forms match like the text does: a query may name any inflected form
    // ("donate") and the hit is the headword that owns it ("donation"). Forms
    // is a JSON array in a text column, so LIKE runs over its serialized text;
    // the row returned is always the word itself, never the form.
    const textMatch = or(
      sql`lower(${word.text}) LIKE lower(${pattern}) ESCAPE '\\'`,
      sql`lower(${word.forms}) LIKE lower(${pattern}) ESCAPE '\\'`,
    );
    return matchMeaning
      ? or(textMatch, sql`lower(${word.meaning}) LIKE lower(${pattern}) ESCAPE '\\'`)
      : textMatch;
  });
  const condition = or(...conditions);
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
        updatedAt: settledAt,
      })
      .onConflictDoUpdate({
        target: [roundWord.bucketId, roundWord.round, roundWord.position],
        set: { reached: true, reachedAt: settledAt, updatedAt: settledAt },
      });
    await tx
      .update(bucketProgress)
      .set({ pointer: position, progressUpdatedAt: settledAt })
      .where(eq(bucketProgress.bucketId, bucketId));
    await tx
      .insert(dailyPointer)
      .values({ day: todayLocalDate(), bucketId, globalPosition, updatedAt: settledAt })
      .onConflictDoUpdate({
        target: [dailyPointer.day, dailyPointer.bucketId],
        set: { globalPosition, updatedAt: settledAt },
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
        set: {
          startedAt: before.startedAt > 0 ? before.startedAt : now,
          finishedAt: now,
          updatedAt: now,
        },
      });
    await tx
      .update(bucketProgress)
      .set({ round: before.round + 1, pointer: 0, startedAt: now, progressUpdatedAt: now })
      .where(eq(bucketProgress.bucketId, bucketId));
  });

  return { round: before.round + 1, pointer: 0, startedAt: now };
}

/** Toggles the flag on a word and records it against the current round. */
export async function setFlag(bucketId: string, position: number, flagged: boolean): Promise<void> {
  const db = await getDb();
  const { round } = await getProgress(bucketId);
  const now = Date.now();

  await withTransaction(async (tx) => {
    await tx
      .update(word)
      .set({ flagged, flaggedAt: now })
      .where(and(eq(word.bucketId, bucketId), eq(word.position, position)));
    if (flagged) {
      await tx
        .insert(roundWord)
        .values({ bucketId, round, position, reached: false, flagged: true, updatedAt: now })
        .onConflictDoUpdate({
          target: [roundWord.bucketId, roundWord.round, roundWord.position],
          set: { flagged: true, updatedAt: now },
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
          .set({ flagged: false, updatedAt: now })
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
      flaggedAt: word.flaggedAt,
    })
    .from(word)
    .innerJoin(
      roundWord,
      and(eq(roundWord.bucketId, word.bucketId), eq(roundWord.position, word.position)),
    )
    .where(
      and(eq(word.bucketId, bucketId), eq(roundWord.round, round), eq(roundWord.flagged, true)),
    )
    .orderBy(word.position);
}

/**
 * Distinct words completed on a local day, across all buckets, rebuilt from
 * the daily pointer high-water marks: the day's globalPosition gain over the
 * previous recorded snapshot names exactly the global positions settled that
 * day — the same rule the stats word counts use, so the queue always matches
 * the number. Per-word reached timestamps are not synced (round_word ships to
 * the cloud compacted per round), so the pointer deltas are what survives a
 * reinstall.
 */
export async function getWordsCompletedOn(day: string): Promise<WordRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(dailyPointer)
    .orderBy(dailyPointer.bucketId, dailyPointer.day);
  const prevByBucket = new Map<string, number>();
  const ranges: { bucketId: string; from: number; to: number }[] = [];
  for (const row of rows) {
    if (row.day === day) {
      const from = (prevByBucket.get(row.bucketId) ?? 0) + 1;
      if (row.globalPosition >= from) {
        ranges.push({ bucketId: row.bucketId, from, to: row.globalPosition });
      }
    }
    prevByBucket.set(row.bucketId, row.globalPosition);
  }

  const out: WordRow[] = [];
  for (const range of ranges) {
    const wordCount = await getWordCount(range.bucketId);
    if (wordCount <= 0) continue;
    // A day's gain is contiguous global positions; crossing a round boundary
    // wraps the within-round positions, and every round replays the same word
    // set, so distinct positions is all the identity we need.
    const positions = new Set<number>();
    for (let gp = range.from; gp <= range.to; gp++) {
      positions.add(((gp - 1) % wordCount) + 1);
    }
    out.push(
      ...(await db
        .select()
        .from(word)
        .where(and(eq(word.bucketId, range.bucketId), inArray(word.position, [...positions])))
        .orderBy(word.position)),
    );
  }
  return out;
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
export async function getRoundFlagCounts(
  bucketId: string,
): Promise<{ green: number; red: number }> {
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
    .select({
      position: roundWord.position,
      reached: roundWord.reached,
      flagged: roundWord.flagged,
    })
    .from(roundWord)
    .where(and(eq(roundWord.bucketId, bucketId), eq(roundWord.round, round)))
    .orderBy(roundWord.position);
}

export async function addDailyTime(
  day: string,
  feedSeconds: number,
  appSeconds: number,
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db
    .insert(dailyStat)
    .values({ day, feedSeconds, appSeconds, updatedAt: now })
    .onConflictDoUpdate({
      target: dailyStat.day,
      set: {
        feedSeconds: sql`${dailyStat.feedSeconds} + excluded.feed_seconds`,
        appSeconds: sql`${dailyStat.appSeconds} + excluded.app_seconds`,
        updatedAt: now,
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
