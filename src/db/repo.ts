import { and, count, desc, eq, gt, inArray, min, or, sql } from 'drizzle-orm';

import type { NormalizedBucket } from '@/lib/bucket-file';

import { dayBounds, todayLocalDate } from '@/lib/date';

import { getDb, withTransaction } from './index';
import {
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  meta,
  reviewCursor,
  roundHistory,
  roundWord,
  word,
  type BucketKind,
} from './schema';
import { DEFAULT_BUCKET_ID } from './seed';

// Rows per batched INSERT, same rationale as seed.ts: SQLite's per-statement
// host-parameter bound.
const INSERT_CHUNK = 500;

export type Bucket = {
  id: string;
  wordCount: number;
  name: string;
  kind: BucketKind;
  language: string;
  source: 'builtin' | 'custom';
  createdAt: number;
};

export type Progress = { round: number; pointer: number; startedAt: number };

export type WordRow = typeof word.$inferSelect;

export type RoundWordRow = { position: number; reached: boolean; flagged: boolean; wrong: boolean };

export type RoundHistoryRow = typeof roundHistory.$inferSelect;

export type DailyStatRow = typeof dailyStat.$inferSelect;

export type DailyPointerRow = typeof dailyPointer.$inferSelect;

export async function listBuckets(): Promise<Bucket[]> {
  const db = await getDb();
  return db.select().from(bucket).orderBy(desc(bucket.wordCount));
}

export async function getBucket(bucketId: string): Promise<Bucket | null> {
  const db = await getDb();
  const row = await db.select().from(bucket).where(eq(bucket.id, bucketId)).get();
  return row ?? null;
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
 *
 * `detail.correct` comes from answer-driven modes (multiple choice): it records
 * the wrong bit on the round's row. Omitted (flip mode) leaves any existing
 * wrong bit untouched — swiping past a card is a reach, not a judgement.
 */
export async function advancePointer(
  bucketId: string,
  position: number,
  detail?: { correct?: boolean },
): Promise<Progress> {
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
  const wrong = detail?.correct === undefined ? null : !detail.correct;

  await withTransaction(async (tx) => {
    await tx
      .insert(roundWord)
      .values({
        bucketId,
        round: before.round,
        position,
        reached: true,
        flagged: flaggedRow?.flagged ?? false,
        wrong: wrong ?? false,
        reachedAt: settledAt,
        updatedAt: settledAt,
      })
      .onConflictDoUpdate({
        target: [roundWord.bucketId, roundWord.round, roundWord.position],
        // wrong only rides writes that judged the card; a plain settle never
        // downgrades a previously recorded wrong answer.
        set: {
          reached: true,
          reachedAt: settledAt,
          updatedAt: settledAt,
          ...(wrong === null ? {} : { wrong }),
        },
      });
    const progressUpdate: { pointer: number; progressUpdatedAt: number; startedAt?: number } = {
      pointer: position,
      progressUpdatedAt: settledAt,
    };
    if (before.startedAt === 0) {
      progressUpdate.startedAt = settledAt;
    }
    await tx
      .update(bucketProgress)
      .set(progressUpdate)
      .where(eq(bucketProgress.bucketId, bucketId));
    await tx
      .insert(dailyPointer)
      .values({ day: todayLocalDate(), bucketId, globalPosition, updatedAt: settledAt })
      .onConflictDoUpdate({
        target: [dailyPointer.day, dailyPointer.bucketId],
        set: { globalPosition, updatedAt: settledAt },
      });
  });

  return {
    ...before,
    pointer: position,
    startedAt: before.startedAt > 0 ? before.startedAt : settledAt,
  };
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
        updatedAt: now,
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
      wrong: roundWord.wrong,
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

export async function getDailyPointersForBucket(bucketId: string): Promise<DailyPointerRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(dailyPointer)
    .where(eq(dailyPointer.bucketId, bucketId))
    .orderBy(dailyPointer.day);
}

/**
 * Recovers the start timestamp of a round from historical word settlements
 * or daily pointer snapshots, used to repair missing or zero startedAt.
 */
export async function recoverRoundStartedAt(
  bucketId: string,
  round: number,
  wordCount: number,
): Promise<number> {
  const db = await getDb();
  const earliestWord = await db
    .select({ reachedAt: min(roundWord.reachedAt) })
    .from(roundWord)
    .where(
      and(
        eq(roundWord.bucketId, bucketId),
        eq(roundWord.round, round),
        eq(roundWord.reached, true),
        gt(roundWord.reachedAt, 0),
      ),
    )
    .get();
  if (earliestWord?.reachedAt && earliestWord.reachedAt > 0) {
    return earliestWord.reachedAt;
  }

  const startGlobalPos = (round - 1) * wordCount + 1;
  const pointers = await db
    .select({ day: dailyPointer.day, globalPosition: dailyPointer.globalPosition })
    .from(dailyPointer)
    .where(eq(dailyPointer.bucketId, bucketId))
    .orderBy(dailyPointer.day);

  for (const p of pointers) {
    if (p.globalPosition >= startGlobalPos) {
      return dayBounds(p.day).start;
    }
  }

  return 0;
}

export async function getDailyStat(day: string): Promise<DailyStatRow | null> {
  const db = await getDb();
  const row = await db.select().from(dailyStat).where(eq(dailyStat.day, day)).get();
  return row ?? null;
}

/** Furthest card settled in a review session (0 when none was recorded). */
export async function getReviewCursor(key: string): Promise<number> {
  const db = await getDb();
  const row = await db.select().from(reviewCursor).where(eq(reviewCursor.key, key)).get();
  return row?.position ?? 0;
}

/**
 * Records the card a review session settled on. Monotonic: swiping back to
 * re-view earlier cards never lowers the resume position, matching the feed's
 * high-water pointer.
 */
export async function saveReviewCursor(key: string, position: number): Promise<void> {
  if (position <= 0) return;
  const db = await getDb();
  await db
    .insert(reviewCursor)
    .values({ key, position })
    .onConflictDoUpdate({
      target: reviewCursor.key,
      set: { position: sql`MAX(${reviewCursor.position}, excluded.position)` },
    });
}

/** Drops a review session's cursor — the queue was finished. */
export async function clearReviewCursor(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(reviewCursor).where(eq(reviewCursor.key, key));
}

/**
 * Inserts or replaces a custom bucket from a parsed import file. A replace
 * renumbers positions, so every position-keyed learning row would point at
 * different content: round-scoped state (round_word, round_history, the
 * bucket's review cursors) resets and progress goes back to round 1, while
 * day-scoped totals (daily_stat, daily_pointer) stay — they describe days,
 * not items. The caller is responsible for wiping the same bucket's cloud
 * rows; the cloud merge rules are monotonic and would otherwise resurrect
 * the reset state on the next pull.
 */
export async function importBucket(parsed: NormalizedBucket): Promise<ImportResult> {
  const db = await getDb();
  const existing = await db
    .select({ id: bucket.id })
    .from(bucket)
    .where(eq(bucket.id, parsed.id))
    .get();
  const replaced = existing != null;
  const now = Date.now();

  await withTransaction(async (tx) => {
    await tx
      .insert(bucket)
      .values({
        id: parsed.id,
        wordCount: parsed.words.length,
        name: parsed.name,
        kind: parsed.kind,
        language: parsed.language,
        source: 'custom',
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: bucket.id,
        set: {
          wordCount: parsed.words.length,
          name: parsed.name,
          kind: parsed.kind,
          language: parsed.language,
          source: 'custom',
          createdAt: now,
        },
      });
    if (replaced) {
      await tx.delete(word).where(eq(word.bucketId, parsed.id));
      await tx.delete(roundWord).where(eq(roundWord.bucketId, parsed.id));
      await tx.delete(roundHistory).where(eq(roundHistory.bucketId, parsed.id));
      await tx
        .delete(reviewCursor)
        .where(
          or(
            eq(reviewCursor.key, `flagged:${parsed.id}`),
            sql`${reviewCursor.key} LIKE ${`round:${parsed.id}:%`}`,
          ),
        );
    }
    for (let i = 0; i < parsed.words.length; i += INSERT_CHUNK) {
      await tx
        .insert(word)
        .values(
          parsed.words.slice(i, i + INSERT_CHUNK).map((w) => ({
            bucketId: parsed.id,
            position: w.position,
            text: w.text,
            ipa: w.ipa,
            meaning: w.meaning,
            forms: w.forms,
            flagged: false,
          })),
        )
        .onConflictDoUpdate({
          target: [word.bucketId, word.position],
          set: {
            text: sql`excluded.text`,
            ipa: sql`excluded.ipa`,
            meaning: sql`excluded.meaning`,
            forms: sql`excluded.forms`,
            flagged: sql`excluded.flagged`,
          },
        });
    }
    await tx
      .insert(bucketProgress)
      .values({ bucketId: parsed.id, progressUpdatedAt: now })
      .onConflictDoUpdate({
        target: bucketProgress.bucketId,
        set: { round: 1, pointer: 0, startedAt: 0, progressUpdatedAt: now },
      });
  });

  return { id: parsed.id, wordCount: parsed.words.length, replaced };
}

export type ImportResult = { id: string; wordCount: number; replaced: boolean };

/**
 * Removes a custom bucket and every learning row keyed by it. Builtins are
 * guarded by the caller. Cloud rows are the caller's concern (wipeMyBucketData)
 * so the same helper stays usable in tests.
 */
export async function deleteCustomBucket(id: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.delete(word).where(eq(word.bucketId, id));
    await tx.delete(bucketProgress).where(eq(bucketProgress.bucketId, id));
    await tx.delete(roundWord).where(eq(roundWord.bucketId, id));
    await tx.delete(roundHistory).where(eq(roundHistory.bucketId, id));
    await tx.delete(dailyPointer).where(eq(dailyPointer.bucketId, id));
    await tx.delete(reviewCursor).where(
      or(
        eq(reviewCursor.key, `flagged:${id}`),
        // `:` delimiters keep '70' from matching bucket '700'.
        sql`${reviewCursor.key} LIKE ${`round:${id}:%`}`,
      ),
    );
    await tx.delete(bucket).where(eq(bucket.id, id));
  });
}

/** Per-bucket rows for the learning-records export; reads only. */
export type LearningRecordBucket = {
  bucket: Bucket;
  words: { position: number; text: string; ipa: string; meaning: string; forms: string[] }[];
  progress: { round: number; pointer: number; startedAt: number; progressUpdatedAt: number };
  history: { round: number; startedAt: number; finishedAt: number }[];
  roundWords: {
    round: number;
    position: number;
    reached: boolean;
    flagged: boolean;
    wrong: boolean;
  }[];
  flags: { position: number; flaggedAt: number }[];
  dailyPointers: { day: string; globalPosition: number }[];
};

export type LearningRecordRows = {
  buckets: LearningRecordBucket[];
  dailyStats: { day: string; feedSeconds: number; appSeconds: number }[];
};

/**
 * Reads everything the learning-records export needs in one bulk pass per
 * table (the sync engine's bulk-read pattern): grouping happens in memory, so
 * the row count never turns into per-bucket queries.
 */
export async function getLearningRecordRows(): Promise<LearningRecordRows> {
  const db = await getDb();
  const [buckets, progressRows, historyRows, roundWordRows, flagRows, pointerRows, statRows] =
    await Promise.all([
      db.select().from(bucket).orderBy(desc(bucket.wordCount)),
      db.select().from(bucketProgress),
      db.select().from(roundHistory).orderBy(roundHistory.bucketId, roundHistory.round),
      db
        .select({
          bucketId: roundWord.bucketId,
          round: roundWord.round,
          position: roundWord.position,
          reached: roundWord.reached,
          flagged: roundWord.flagged,
          wrong: roundWord.wrong,
        })
        .from(roundWord)
        .orderBy(roundWord.bucketId, roundWord.round, roundWord.position),
      db
        .select({ bucketId: word.bucketId, position: word.position, flaggedAt: word.flaggedAt })
        .from(word)
        .where(eq(word.flagged, true))
        .orderBy(word.bucketId, word.position),
      db.select().from(dailyPointer).orderBy(dailyPointer.bucketId, dailyPointer.day),
      db.select().from(dailyStat).orderBy(dailyStat.day),
    ]);

  const customIds = buckets.filter((b) => b.source === 'custom').map((b) => b.id);
  const customWords = customIds.length
    ? await db.select().from(word).where(inArray(word.bucketId, customIds)).orderBy(word.position)
    : [];
  const wordsByBucket = new Map<string, LearningRecordBucket['words']>();
  for (const w of customWords) {
    let list = wordsByBucket.get(w.bucketId);
    if (!list) {
      list = [];
      wordsByBucket.set(w.bucketId, list);
    }
    list.push({
      position: w.position,
      text: w.text,
      ipa: w.ipa,
      meaning: w.meaning,
      forms: w.forms,
    });
  }

  const progressByBucket = new Map(progressRows.map((p) => [p.bucketId, p]));
  const wordsGroup = groupByBucketKey(roundWordRows);
  const flagsGroup = groupByBucketKey(flagRows);
  const pointersGroup = groupByBucketKey(pointerRows);
  const historyGroup = groupByBucketKey(historyRows);

  return {
    buckets: buckets.map((b) => {
      const progress = progressByBucket.get(b.id);
      return {
        bucket: b,
        words: wordsByBucket.get(b.id) ?? [],
        progress: {
          round: progress?.round ?? 1,
          pointer: progress?.pointer ?? 0,
          startedAt: progress?.startedAt ?? 0,
          progressUpdatedAt: progress?.progressUpdatedAt ?? 0,
        },
        history: (historyGroup.get(b.id) ?? []).map((h) => ({
          round: h.round,
          startedAt: h.startedAt,
          finishedAt: h.finishedAt,
        })),
        roundWords: (wordsGroup.get(b.id) ?? []).map((r) => ({
          round: r.round,
          position: r.position,
          reached: r.reached,
          flagged: r.flagged,
          wrong: r.wrong,
        })),
        flags: (flagsGroup.get(b.id) ?? []).map((f) => ({
          position: f.position,
          flaggedAt: f.flaggedAt,
        })),
        dailyPointers: (pointersGroup.get(b.id) ?? []).map((p) => ({
          day: p.day,
          globalPosition: p.globalPosition,
        })),
      };
    }),
    dailyStats: statRows.map((s) => ({
      day: s.day,
      feedSeconds: s.feedSeconds,
      appSeconds: s.appSeconds,
    })),
  };
}

function groupByBucketKey<T extends { bucketId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    let list = map.get(row.bucketId);
    if (!list) {
      list = [];
      map.set(row.bucketId, list);
    }
    list.push(row);
  }
  return map;
}
