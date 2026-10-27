import { and, count, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm'
import * as Crypto from 'expo-crypto'

import type { Word } from '@/types/word'

import { todayLocalDate } from '@/lib/date'

import { getDb, withTransaction, type Db } from './index'
import {
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  reviewSession,
  roundFlag,
  roundHistory,
  word,
} from './schema'

export type Progress = { round: number; pointer: number; roundStartedAt: number }

export type WordWithFlag = Word & { flagged: boolean }

export type { ReviewSessionRow } from './schema'

export type RoundSummary = {
  round: number
  startedAt: number
  /** 0 while the round is still the probe's current one. */
  finishedAt: number
  done: boolean
  /** The round's reach frontier: wordCount when done, the probe otherwise. */
  pointer: number
  /** Green = reached (pointer swept over it) and not flagged; red = flagged. */
  green: number
  red: number
  /** Flag positions of this round, ascending — the red cells of the bar. */
  flags: number[]
  /** Completed review walk-throughs of this round's flag list. */
  reviewTimes: number
  /** True when an uncounted draft session exists for this round. */
  hasDraft: boolean
}

const DEFAULT_PROGRESS: Progress = { round: 1, pointer: 0, roundStartedAt: 0 }

function mapWord(row: {
  position: number
  text: string
  ipa: string
  meaning: string
  forms: string[] | null
}): Word {
  return {
    position: row.position,
    word: row.text,
    ipa: row.ipa,
    meaning: row.meaning,
    forms: row.forms ?? [],
  }
}

async function readProbe(db: Db, bucketId: string): Promise<Progress> {
  const row = await db
    .select()
    .from(bucketProgress)
    .where(eq(bucketProgress.bucketId, bucketId))
    .get()
  return row ?? DEFAULT_PROGRESS
}

async function readWordCount(db: Db, bucketId: string): Promise<number> {
  const row = await db
    .select({ wordCount: bucket.wordCount })
    .from(bucket)
    .where(eq(bucket.id, bucketId))
    .get()
  return row?.wordCount ?? 0
}

// --- reads ---------------------------------------------------------------

export async function listBuckets() {
  const db = await getDb()
  return db.select().from(bucket).orderBy(bucket.id)
}

export type BucketCard = {
  id: string
  wordCount: number
  round: number
  pointer: number
  flagCount: number
}

/** One row per bucket for list screens: the probe plus the current round's flags. */
export async function getBucketCards(): Promise<BucketCard[]> {
  const db = await getDb()
  const rows = await db.select().from(bucket).orderBy(bucket.id)
  return Promise.all(
    rows.map(async (row) => {
      const probe = await readProbe(db, row.id)
      const flagCount = await countRoundFlags(row.id, probe.round)
      return {
        id: row.id,
        wordCount: row.wordCount,
        round: probe.round,
        pointer: probe.pointer,
        flagCount,
      }
    }),
  )
}

/** The given words, in the order the positions were passed in. */
export async function getWordsByPositions(bucketId: string, positions: number[]): Promise<Word[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(word)
    .where(and(eq(word.bucketId, bucketId), inArray(word.position, positions)))
  const byPosition = new Map(rows.map((row) => [row.position, row]))
  return positions.flatMap((position) => {
    const row = byPosition.get(position)
    return row ? [mapWord(row)] : []
  })
}

export async function getProgress(bucketId: string): Promise<Progress> {
  const db = await getDb()
  return readProbe(db, bucketId)
}

export async function getWordCount(bucketId: string): Promise<number> {
  const db = await getDb()
  return readWordCount(db, bucketId)
}

export async function getWords(bucketId: string): Promise<Word[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(word)
    .where(eq(word.bucketId, bucketId))
    .orderBy(word.position)
  return rows.map(mapWord)
}

/**
 * The bucket's words with the flag state of ONE round (the caller decides
 * which: the probe's round for the word list and the feed, a pinned round
 * for a review-context browse).
 */
export async function getWordsWithRoundFlag(
  bucketId: string,
  round: number,
): Promise<WordWithFlag[]> {
  const db = await getDb()
  const rows = await db
    .select({
      position: word.position,
      text: word.text,
      ipa: word.ipa,
      meaning: word.meaning,
      forms: word.forms,
      flagged: sql<number>`CASE WHEN ${roundFlag.position} IS NULL THEN 0 ELSE 1 END`,
    })
    .from(word)
    .leftJoin(
      roundFlag,
      and(
        eq(roundFlag.bucketId, word.bucketId),
        eq(roundFlag.round, round),
        eq(roundFlag.position, word.position),
      ),
    )
    .where(eq(word.bucketId, bucketId))
    .orderBy(word.position)
  return rows.map((row) => ({ ...mapWord(row), flagged: !!row.flagged }))
}

export async function countRoundFlags(bucketId: string, round: number): Promise<number> {
  const db = await getDb()
  const row = await db
    .select({ n: count() })
    .from(roundFlag)
    .where(and(eq(roundFlag.bucketId, bucketId), eq(roundFlag.round, round)))
    .get()
  return row?.n ?? 0
}

/**
 * Every round of the bucket in order: finished ones from round_history plus
 * the probe's current one. Green is derived, never stored — reached means
 * the pointer swept over the word (exposure semantics, the same yardstick
 * the daily word count uses).
 */
export async function getRoundSummaries(bucketId: string): Promise<RoundSummary[]> {
  const db = await getDb()
  const [wordCount, history, probe, flagRows, badges, drafts] = await Promise.all([
    readWordCount(db, bucketId),
    db
      .select()
      .from(roundHistory)
      .where(eq(roundHistory.bucketId, bucketId))
      .orderBy(roundHistory.round),
    readProbe(db, bucketId),
    db
      .select({ round: roundFlag.round, position: roundFlag.position })
      .from(roundFlag)
      .where(eq(roundFlag.bucketId, bucketId)),
    db
      .select({
        round: reviewSession.round,
        times: sql<number>`MAX(${reviewSession.number})`,
      })
      .from(reviewSession)
      .where(and(eq(reviewSession.bucketId, bucketId), eq(reviewSession.counted, true)))
      .groupBy(reviewSession.round),
    db
      .select({ round: reviewSession.round })
      .from(reviewSession)
      .where(
        and(
          eq(reviewSession.bucketId, bucketId),
          eq(reviewSession.counted, false),
          isNull(reviewSession.finishedAt),
        ),
      ),
  ])

  const flagsByRound = new Map<number, number[]>()
  for (const row of flagRows) {
    const list = flagsByRound.get(row.round)
    if (list) list.push(row.position)
    else flagsByRound.set(row.round, [row.position])
  }
  const badgeByRound = new Map(badges.map((row) => [row.round, row.times ?? 0]))
  const draftByRound = new Map(drafts.map((row) => [row.round, true]))

  const greenOf = (round: number, frontier: number): number => {
    const flags = flagsByRound.get(round) ?? []
    return frontier - flags.filter((position) => position <= frontier).length
  }

  const summaries: RoundSummary[] = history.map((row) => ({
    round: row.round,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    done: true,
    pointer: wordCount,
    green: greenOf(row.round, wordCount),
    red: (flagsByRound.get(row.round) ?? []).length,
    flags: flagsByRound.get(row.round) ?? [],
    reviewTimes: badgeByRound.get(row.round) ?? 0,
    hasDraft: draftByRound.get(row.round) ?? false,
  }))

  const roundNumbers = new Set(history.map((row) => row.round))
  if (!roundNumbers.has(probe.round)) {
    summaries.push({
      round: probe.round,
      startedAt: probe.roundStartedAt,
      finishedAt: 0,
      done: false,
      pointer: probe.pointer,
      green: greenOf(probe.round, probe.pointer),
      red: (flagsByRound.get(probe.round) ?? []).length,
      flags: flagsByRound.get(probe.round) ?? [],
      reviewTimes: badgeByRound.get(probe.round) ?? 0,
      hasDraft: draftByRound.get(probe.round) ?? false,
    })
  }
  return summaries.sort((a, b) => a.round - b.round)
}

// --- feed writes ---------------------------------------------------------

/**
 * Records a hand-settled card: the probe moves forward (never backward) and
 * today's high-water snapshot is updated. Positions skipped by a jump are
 * swept over the same way — exposure semantics.
 */
export async function settleCard(bucketId: string, index: number): Promise<void> {
  await withTransaction(async (tx) => {
    const probe = await readProbe(tx, bucketId)
    if (index <= probe.pointer) return
    const wordCount = await readWordCount(tx, bucketId)
    const now = Date.now()
    await tx
      .insert(bucketProgress)
      .values({
        bucketId,
        round: probe.round,
        pointer: index,
        roundStartedAt: probe.roundStartedAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: bucketProgress.bucketId,
        set: { pointer: index, updatedAt: now },
      })
    await upsertDailyPointer(tx, todayLocalDate(), bucketId, (probe.round - 1) * wordCount + index)
  })
}

/**
 * Archives the current round (the end card was settled by hand in study
 * mode) and opens the next one, all in one transaction — there is no
 * "walked through but not advanced" limbo state.
 */
export async function completeRound(bucketId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const probe = await readProbe(tx, bucketId)
    const wordCount = await readWordCount(tx, bucketId)
    if (wordCount <= 0 || probe.pointer < wordCount - 1) return
    const now = Date.now()
    // The end card completes the round's last word on today's watermark.
    await upsertDailyPointer(tx, todayLocalDate(), bucketId, probe.round * wordCount)
    await tx
      .insert(roundHistory)
      .values({
        bucketId,
        round: probe.round,
        startedAt: probe.roundStartedAt || now,
        finishedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [roundHistory.bucketId, roundHistory.round],
        set: { finishedAt: now, updatedAt: now },
      })
    await tx
      .insert(bucketProgress)
      .values({
        bucketId,
        round: probe.round + 1,
        pointer: 0,
        roundStartedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: bucketProgress.bucketId,
        set: { round: probe.round + 1, pointer: 0, roundStartedAt: now, updatedAt: now },
      })
  })
}

function upsertDailyPointer(tx: Db, day: string, bucketId: string, globalPosition: number) {
  return tx
    .insert(dailyPointer)
    .values({ day, bucketId, globalPosition, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: [dailyPointer.day, dailyPointer.bucketId],
      set: { globalPosition, updatedAt: Date.now() },
    })
}

// --- flags ---------------------------------------------------------------

/**
 * Sets a word's flag on ONE round's list. The round is always explicit:
 * feed flags target the probe's round, review/browse target their pinned
 * round — the repo never derives it (an MVP bug this rule precludes).
 */
export async function setRoundFlag(
  bucketId: string,
  round: number,
  position: number,
  flagged: boolean,
): Promise<void> {
  const db = await getDb()
  const probe = await readProbe(db, bucketId)
  if (round > probe.round)
    throw new Error(`cannot flag round ${round} beyond the probe (${probe.round})`)
  const now = Date.now()
  if (flagged) {
    await db
      .insert(roundFlag)
      .values({ bucketId, round, position, flaggedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [roundFlag.bucketId, roundFlag.round, roundFlag.position],
        set: { flaggedAt: now, updatedAt: now },
      })
  } else {
    await db
      .delete(roundFlag)
      .where(
        and(
          eq(roundFlag.bucketId, bucketId),
          eq(roundFlag.round, round),
          eq(roundFlag.position, position),
        ),
      )
  }
}

// --- review sessions -----------------------------------------------------

/** The round's feed is complete once its round_history row exists. */
async function isRoundComplete(db: Db, bucketId: string, round: number): Promise<boolean> {
  const row = await db
    .select({ round: roundHistory.round })
    .from(roundHistory)
    .where(and(eq(roundHistory.bucketId, bucketId), eq(roundHistory.round, round)))
    .get()
  return !!row
}

/**
 * Opens (or resumes) a review walk-through of one round's flag list.
 *   - An open session is resumed as-is: its queue snapshot and cursor stay
 *     frozen; flag edits since never rewrite an in-flight walk.
 *   - With the feed complete, a fresh entry discards all drafts (抹零) and
 *     starts the real `time {n+1}` from the current flag list.
 *   - Without it, a single draft is kept (resumable, never counted).
 * Returns null when the round has no flags at all — no session for that.
 */
export async function openReviewSession(
  bucketId: string,
  round: number,
): Promise<typeof reviewSession.$inferSelect | null> {
  const db = await getDb()
  const flagRows = await db
    .select({ position: roundFlag.position })
    .from(roundFlag)
    .where(and(eq(roundFlag.bucketId, bucketId), eq(roundFlag.round, round)))
    .orderBy(roundFlag.position)
  const queue = flagRows.map((row) => row.position)
  if (queue.length === 0) return null

  const open = await db
    .select()
    .from(reviewSession)
    .where(
      and(
        eq(reviewSession.bucketId, bucketId),
        eq(reviewSession.round, round),
        isNull(reviewSession.finishedAt),
      ),
    )
    .get()
  const roundDone = await isRoundComplete(db, bucketId, round)
  // Resume an open session — except a draft whose feed has since completed:
  // its queue snapshot predates the finished round, so it can never become a
  // real review. It is discarded and the walk starts fresh below (抹零).
  if (open && (open.counted || !roundDone)) return open

  const now = Date.now()
  const where = and(eq(reviewSession.bucketId, bucketId), eq(reviewSession.round, round))
  if (roundDone) {
    // The real walk-through: drafts are zeroed and the number sticks.
    await db.delete(reviewSession).where(and(where, eq(reviewSession.counted, false)))
    const counted = await db
      .select({ n: count() })
      .from(reviewSession)
      .where(and(where, eq(reviewSession.counted, true)))
      .get()
    return db
      .insert(reviewSession)
      .values({
        id: Crypto.randomUUID(),
        bucketId,
        round,
        counted: true,
        number: (counted?.n ?? 0) + 1,
        queue,
        lastPosition: 0,
        startedAt: now,
        updatedAt: now,
      })
      .returning()
      .get()
  }
  // A draft. Finished drafts were deleted on completion; this clears any
  // straggler so the single-draft unique index holds.
  await db
    .delete(reviewSession)
    .where(and(where, eq(reviewSession.counted, false), isNotNull(reviewSession.finishedAt)))
  return db
    .insert(reviewSession)
    .values({
      id: Crypto.randomUUID(),
      bucketId,
      round,
      counted: false,
      number: null,
      queue,
      lastPosition: 0,
      startedAt: now,
      updatedAt: now,
    })
    .returning()
    .get()
}

/** Advances the session's resume watermark; monotonic, in word positions. */
export async function settleReview(sessionId: string, position: number): Promise<void> {
  const db = await getDb()
  await db
    .update(reviewSession)
    .set({
      lastPosition: sql`MAX(${reviewSession.lastPosition}, ${position})`,
      updatedAt: Date.now(),
    })
    .where(eq(reviewSession.id, sessionId))
}

/**
 * The walk reached its end card: a counted session is archived with its
 * finish time; a draft is deleted — unfinished-feed reviews leave no trace.
 */
export async function finishReview(sessionId: string): Promise<void> {
  const db = await getDb()
  const session = await db.select().from(reviewSession).where(eq(reviewSession.id, sessionId)).get()
  if (!session || session.finishedAt != null) return
  if (session.counted) {
    await db
      .update(reviewSession)
      .set({ finishedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(reviewSession.id, sessionId))
  } else {
    await db.delete(reviewSession).where(eq(reviewSession.id, sessionId))
  }
}

/** How many real walk-throughs the round has — a draft displays n + 1. */
export async function countedReviewCount(bucketId: string, round: number): Promise<number> {
  const db = await getDb()
  const row = await db
    .select({ n: count() })
    .from(reviewSession)
    .where(
      and(
        eq(reviewSession.bucketId, bucketId),
        eq(reviewSession.round, round),
        eq(reviewSession.counted, true),
      ),
    )
    .get()
  return row?.n ?? 0
}

// --- daily stats ---------------------------------------------------------

export async function addDailyTime(
  day: string,
  feedSeconds: number,
  appSeconds: number,
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
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
    })
}

export async function listDailyStats() {
  const db = await getDb()
  return db.select().from(dailyStat).orderBy(dailyStat.day)
}

export async function listDailyPointers() {
  const db = await getDb()
  return db.select().from(dailyPointer).orderBy(dailyPointer.day)
}

// --- search ---------------------------------------------------------------

/**
 * Translates user input into a SQL LIKE pattern, matching SQL semantics:
 *   %  any run of zero or more characters
 *   _  exactly one character
 * A query with no wildcard characters is wrapped as a contains-match
 * (%query%), so a plain word search still finds substrings. Examples:
 * `ter%` matches words starting with ter, `%ter` ending with ter, `wo%rd`
 * exactly starting with wo and ending with rd.
 */
function toLikePattern(query: string): string {
  let out = ''
  let hasWildcard = false
  for (const ch of query) {
    if (ch === '%') {
      out += '%'
      hasWildcard = true
    } else if (ch === '_') {
      out += '_'
      hasWildcard = true
    } else {
      out += ch
    }
  }
  return hasWildcard ? out : `%${out}%`
}

export type SearchResult = Word & { bucketId: string }

/**
 * Case-insensitive lookup over the word, its inflected forms (a JSON column
 * LIKE'd as text — the row returned is always the headword) and, optionally,
 * the Chinese meaning. `|` splits the query into alternatives whose results
 * are unioned (`scene|sense`), each keeping the %/_ rules.
 */
export async function searchWords(
  bucketId: string,
  query: string,
  options: { matchMeaning?: boolean; limit?: number } = {},
): Promise<SearchResult[]> {
  const { matchMeaning = true, limit = 100 } = options
  const db = await getDb()
  const trimmed = query.trim()
  const alternatives = trimmed
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  const parts = alternatives.length > 0 ? alternatives : [trimmed]
  const conditions = parts.map((part) => {
    const pattern = toLikePattern(part)
    const textMatch = sql`lower(${word.text}) LIKE lower(${pattern}) ESCAPE '\\'
      OR lower(${word.forms}) LIKE lower(${pattern}) ESCAPE '\\'`
    return matchMeaning
      ? sql`(${textMatch} OR lower(${word.meaning}) LIKE lower(${pattern}) ESCAPE '\\')`
      : sql`(${textMatch})`
  })
  const rows = await db
    .select()
    .from(word)
    .where(and(eq(word.bucketId, bucketId), sql.join(conditions, sql` OR `)))
    .orderBy(word.position)
    .limit(limit)
  return rows.map((row) => ({ ...mapWord(row), bucketId: row.bucketId }))
}
