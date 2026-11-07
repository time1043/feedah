import { and, count, eq, gte, inArray, isNull, isNotNull, lte, sql } from 'drizzle-orm'
import * as Crypto from 'expo-crypto'

import type { Distractor, Word } from '@/types/word'

import { todayLocalDate } from '@/lib/date'

import { getDb, withTransaction, type Db } from './index'
import {
  answerLog,
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  reviewSession,
  roundFlag,
  roundHistory,
  word,
} from './schema'
import { BUNDLED_BUCKET_IDS, seedBuckets } from './seed'

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
  /** Card ordinals (0-based, position-ordered) of this round's flags — the
   * red cells of the bar. */
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
  distractors: Distractor[] | null
}): Word {
  return {
    position: row.position,
    word: row.text,
    ipa: row.ipa,
    meaning: row.meaning,
    forms: row.forms ?? [],
    distractors: row.distractors ?? [],
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
  return db.select().from(bucket).where(isNull(bucket.deletedAt)).orderBy(bucket.id)
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
  const rows = await db.select().from(bucket).where(isNull(bucket.deletedAt)).orderBy(bucket.id)
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

// --- bucket lifecycle -----------------------------------------------------

/**
 * Soft-deletes a bucket: the row and every child (words, progress, flags,
 * rounds, sessions, daily pointers) stay, but every list stops showing it.
 * The statistics diary never shrinks retroactively, and re-importing the
 * same JSON un-tombstones the bucket exactly as it was.
 */
export async function deleteBucket(id: string): Promise<void> {
  const db = await getDb()
  await db
    .update(bucket)
    .set({ deletedAt: Date.now() })
    .where(and(eq(bucket.id, id), isNull(bucket.deletedAt)))
}

/** Bundled bucket ids currently tombstoned — the restore row's audience. */
export async function tombstonedBuckets(): Promise<string[]> {
  const db = await getDb()
  const rows = await db
    .select({ id: bucket.id })
    .from(bucket)
    .where(and(isNotNull(bucket.deletedAt), inArray(bucket.id, BUNDLED_BUCKET_IDS)))
  return rows.map((row) => row.id)
}

/**
 * Un-tombstones the given bundled buckets and re-runs the seed: their rows
 * never left, so a restored bucket reappears with its full history intact
 * (and a bundle changed while deleted gets its words refreshed).
 */
export async function restoreBuckets(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDb()
  await db
    .update(bucket)
    .set({ deletedAt: null })
    .where(and(inArray(bucket.id, ids), isNotNull(bucket.deletedAt)))
  await seedBuckets(db, withTransaction)
}

export async function getProgress(bucketId: string): Promise<Progress> {
  const db = await getDb()
  return readProbe(db, bucketId)
}

export async function getWordCount(bucketId: string): Promise<number> {
  const db = await getDb()
  return readWordCount(db, bucketId)
}

/** Full word list in deck order. Test/infra helper — screens use the
 * flag-joined variant. */
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
      distractors: word.distractors,
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
 * the daily word count uses). Flag positions are reported as card ordinals
 * (their 0-based index in the bucket's position-ordered word list): the
 * probe sweeps card indices, and word positions are arbitrary ids that may
 * not even start at 1.
 */
export async function getRoundSummaries(bucketId: string): Promise<RoundSummary[]> {
  const db = await getDb()
  const [wordCount, history, probe, wordRows, flagRows, badges, drafts] = await Promise.all([
    readWordCount(db, bucketId),
    db
      .select()
      .from(roundHistory)
      .where(eq(roundHistory.bucketId, bucketId))
      .orderBy(roundHistory.round),
    readProbe(db, bucketId),
    db
      .select({ position: word.position })
      .from(word)
      .where(eq(word.bucketId, bucketId))
      .orderBy(word.position),
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

  // Word positions are arbitrary ids: translate them into card ordinals so
  // they can be compared against the probe's pointer.
  const ordinalByPosition = new Map(wordRows.map((row, i) => [row.position, i]))
  const flagsByRound = new Map<number, number[]>()
  for (const row of flagRows) {
    const ordinal = ordinalByPosition.get(row.position)
    if (ordinal === undefined) continue
    const list = flagsByRound.get(row.round)
    if (list) list.push(ordinal)
    else flagsByRound.set(row.round, [ordinal])
  }
  for (const list of flagsByRound.values()) list.sort((a, b) => a - b)
  const badgeByRound = new Map(badges.map((row) => [row.round, row.times ?? 0]))
  const draftByRound = new Map(drafts.map((row) => [row.round, true]))

  const greenOf = (round: number, frontier: number): number => {
    const flags = flagsByRound.get(round) ?? []
    return frontier - flags.filter((ordinal) => ordinal < frontier).length
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
 * "walked through but not advanced" limbo state. The next round starts as a
 * copy of the finished round's flag list (回显): the user can then unflag or
 * add flags on it freely, while the finished round's own list stays frozen
 * as review history.
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
    const carried = await tx
      .select({ position: roundFlag.position, flaggedAt: roundFlag.flaggedAt })
      .from(roundFlag)
      .where(and(eq(roundFlag.bucketId, bucketId), eq(roundFlag.round, probe.round)))
    if (carried.length > 0) {
      await tx
        .insert(roundFlag)
        .values(
          carried.map((row) => ({
            bucketId,
            round: probe.round + 1,
            position: row.position,
            flaggedAt: row.flaggedAt,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing()
    }
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

// --- answers -------------------------------------------------------------

/**
 * Appends one quiz/typing answer to the log. Write-only data: nothing gates
 * paging or flags on it, and the existing statistics never read it.
 */
export async function recordAnswer(params: {
  bucketId: string
  round: number
  position: number
  mode: string
  correct: boolean
}): Promise<void> {
  const db = await getDb()
  await db.insert(answerLog).values({
    id: Crypto.randomUUID(),
    bucketId: params.bucketId,
    round: params.round,
    position: params.position,
    mode: params.mode,
    correct: params.correct,
    answeredAt: Date.now(),
  })
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

/** The bucket's word positions flagged in one round, ascending. */
export async function getRoundFlagPositions(bucketId: string, round: number): Promise<number[]> {
  const db = await getDb()
  const rows = await db
    .select({ position: roundFlag.position })
    .from(roundFlag)
    .where(and(eq(roundFlag.bucketId, bucketId), eq(roundFlag.round, round)))
    .orderBy(roundFlag.position)
  return rows.map((row) => row.position)
}

/** One entry of a day review: the word, its bucket, the round it was
 * walked in and that round's flag state — the same word may appear under
 * several rounds of one day, flagged differently in each. */
export type DayWord = Word & { bucketId: string; round: number; flagged: boolean }

/**
 * The words studied on a local day, across all buckets, in study order —
 * rebuilt from the daily pointer high-water marks: the day's globalPosition
 * gain over the previous recorded snapshot names exactly the global
 * positions settled that day (the same rule the stats word counts use, so
 * the queue always matches the number). A global position maps to
 * (round, position) through the bucket's word count, so a day spanning
 * several rounds of one bucket contributes every round's stretch — the same
 * word appears once per round it was walked in, deliberately without
 * dedup. Rows carry their bucket id (a day review spans buckets).
 */
export async function getWordsCompletedOn(day: string): Promise<DayWord[]> {
  const db = await getDb()
  const pointers = await db
    .select()
    .from(dailyPointer)
    .orderBy(dailyPointer.bucketId, dailyPointer.day)
  const prevByBucket = new Map<string, number>()
  const ranges: { bucketId: string; from: number; to: number }[] = []
  for (const row of pointers) {
    if (row.day === day) {
      const from = (prevByBucket.get(row.bucketId) ?? 0) + 1
      if (row.globalPosition >= from) {
        ranges.push({ bucketId: row.bucketId, from, to: row.globalPosition })
      }
    }
    prevByBucket.set(row.bucketId, row.globalPosition)
  }

  // Per-bucket expansion table, fetched once and reused across ranges
  // (rounds repeat positions; the word itself does not change).
  const buckets = new Map<string, { wordCount: number; words: Map<number, Word> }>()
  const out: DayWord[] = []
  for (const range of ranges) {
    let entry = buckets.get(range.bucketId)
    if (!entry) {
      // The global position encodes (round, position) against the bucket's
      // declared word count — the same number settleCard encoded with.
      const bucketRow = await db
        .select({ wordCount: bucket.wordCount })
        .from(bucket)
        .where(eq(bucket.id, range.bucketId))
        .get()
      const rows = await db.select().from(word).where(eq(word.bucketId, range.bucketId))
      entry = {
        wordCount: bucketRow?.wordCount ?? 0,
        words: new Map(rows.map((row) => [row.position, mapWord(row)])),
      }
      buckets.set(range.bucketId, entry)
    }
    if (entry.wordCount === 0) continue
    // The entry shows the flag state of its own round: a replay of the day
    // should look the way the day looked.
    const firstRound = Math.floor((range.from - 1) / entry.wordCount) + 1
    const lastRound = Math.floor((range.to - 1) / entry.wordCount) + 1
    const flagRows = await db
      .select({ round: roundFlag.round, position: roundFlag.position })
      .from(roundFlag)
      .where(
        and(
          eq(roundFlag.bucketId, range.bucketId),
          gte(roundFlag.round, firstRound),
          lte(roundFlag.round, lastRound),
        ),
      )
    const flagged = new Set(flagRows.map((row) => `${row.round}:${row.position}`))
    for (let global = range.from; global <= range.to; global++) {
      const round = Math.floor((global - 1) / entry.wordCount) + 1
      const position = ((global - 1) % entry.wordCount) + 1
      const found = entry.words.get(position)
      if (found) {
        out.push({
          ...found,
          bucketId: range.bucketId,
          round,
          flagged: flagged.has(`${round}:${position}`),
        })
      }
    }
  }
  return out
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
export async function searchWords(bucketId: string, query: string): Promise<SearchResult[]> {
  const matchMeaning = true
  const limit = 100
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
