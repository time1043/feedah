import { and, count, eq } from 'drizzle-orm'

import type { WordRow } from './bucket-word'

import { getDb, withTransaction } from '../index'
import { bucket, word } from '../schema/bucket-word'
import { bucketProgress, roundFlag, roundRecord } from '../schema/study-round'

/** How many flag rows one carried-over INSERT may bind: 4 values each, kept
 * well under SQLite's variable limit. */
const CARRY_CHUNK = 200

/**
 * The study probe, as the session carries it: the round being studied and
 * the card index (0-based, the same number the reducer holds) the walk is
 * parked on — a reload resumes exactly there. roundStartedAt is a wall-clock
 * stamp of when that round began (0 for a probe that predates one).
 */
export type ProgressRow = {
  round: number
  pointer: number
  roundStartedAt: number
}

/** A word of one round: the static entry plus that round's flag state. */
export type RoundWordRow = WordRow & { flagged: boolean }

/** The study probe of one bucket; a missing row means the bucket was never
 * studied and reads the factory probe (round 1, card 0). */
export async function getProgress(bucketName: string): Promise<ProgressRow> {
  const db = await getDb()
  const rows = await db
    .select({
      round: bucketProgress.round,
      pointer: bucketProgress.pointer,
      roundStartedAt: bucketProgress.roundStartedAt,
    })
    .from(bucketProgress)
    .where(eq(bucketProgress.bucketName, bucketName))
    .limit(1)
  // A fresh object every time: the caller owns the probe it reads.
  return rows[0] ?? { round: 1, pointer: 0, roundStartedAt: 0 }
}

/**
 * The settle write: the pointer only ever moves forward (card N is behind
 * you once you have reached card N+1). Creates the probe row — round 1, the
 * round it stamps — on the first settle of a fresh bucket.
 */
export async function settleCard(bucketName: string, pointer: number): Promise<void> {
  const db = await getDb()
  await withTransaction(async () => {
    const rows = await db
      .select({ pointer: bucketProgress.pointer })
      .from(bucketProgress)
      .where(eq(bucketProgress.bucketName, bucketName))
      .limit(1)
    if (rows.length === 0) {
      await db
        .insert(bucketProgress)
        .values({ bucketName, round: 1, pointer, roundStartedAt: Date.now() })
        .onConflictDoNothing()
      return
    }
    if (pointer > rows[0].pointer) {
      await db
        .update(bucketProgress)
        .set({ pointer })
        .where(eq(bucketProgress.bucketName, bucketName))
    }
  })
}

/**
 * Completes the round: the finished round is recorded (its start and this end
 * stamp), its flags are carried into the next round, and the probe steps on at
 * the first card. All of it shares one transaction — a round never advances
 * without its record, and never starts without the marks it inherited.
 */
export async function completeRound(bucketName: string, now: number): Promise<void> {
  const db = await getDb()
  await withTransaction(async () => {
    const rows = await db
      .select({ round: bucketProgress.round, roundStartedAt: bucketProgress.roundStartedAt })
      .from(bucketProgress)
      .where(eq(bucketProgress.bucketName, bucketName))
      .limit(1)
    // A completed round implies the probe exists (reaching the end needed
    // settles), but a missing row still reads as round 1 with no start.
    const finished = rows[0] ?? { round: 1, roundStartedAt: 0 }
    const next = finished.round + 1

    // One row per round, first write wins: a duplicate completion must not
    // move the recorded span.
    await db
      .insert(roundRecord)
      .values({
        bucketName,
        round: finished.round,
        startedAt: finished.roundStartedAt,
        endedAt: now,
      })
      .onConflictDoNothing()

    // Carry the marks forward: the words you flagged are exactly what the next
    // round should open on, and the deck reloads its flags from this table. The
    // new round owns its own rows, so clearing or adding a mark there never
    // rewrites the finished round's history.
    const flags = await db
      .select({ position: roundFlag.position })
      .from(roundFlag)
      .where(and(eq(roundFlag.bucketName, bucketName), eq(roundFlag.round, finished.round)))
    // Chunked: a bucket can hold thousands of words, and one INSERT carries
    // four bound values per row — past a few hundred rows it would exceed
    // SQLite's variable limit.
    for (let start = 0; start < flags.length; start += CARRY_CHUNK) {
      await db
        .insert(roundFlag)
        .values(
          flags.slice(start, start + CARRY_CHUNK).map((flag) => ({
            bucketName,
            round: next,
            position: flag.position,
            flaggedAt: now,
          })),
        )
        .onConflictDoNothing()
    }

    if (rows.length === 0) {
      await db
        .insert(bucketProgress)
        .values({ bucketName, round: next, pointer: 0, roundStartedAt: now })
        .onConflictDoNothing()
      return
    }
    await db
      .update(bucketProgress)
      .set({ round: next, pointer: 0, roundStartedAt: now })
      .where(eq(bucketProgress.bucketName, bucketName))
  })
}

/** One row of the round list: a round the probe has entered, with what the
 * walk did in it and which cards it flagged. */
export type RoundRow = {
  round: number
  /** The probe has moved past it: the round was walked to the end. */
  done: boolean
  /** The bucket's word count — the timeline's denominator. */
  wordCount: number
  /** Cards the walk reached, as a COUNT (not a word position). */
  swept: number
  /** The round's flagged cards as 0-based ORDINALS into the position-ordered
   * list — what the timeline paints. The table itself keeps word positions,
   * so the translation happens here. */
  flags: number[]
  /** 0 when unrecorded — a round that has not been entered yet. */
  startedAt: number
  /** The finishing stamp; null while the round is still in progress. */
  endedAt: number | null
}

/**
 * Every round of one bucket, newest first — the live round is what the page
 * is opened for. The probe holds that live round; round_record holds the
 * finished ones' spans, so no history table is needed for the boundary
 * between rounds.
 */
export async function getRoundsByBucket(bucketName: string): Promise<[boolean, RoundRow[]]> {
  const db = await getDb()
  // The bucket row is the existence check; the words themselves are the list
  // the timeline is drawn against.
  const exists = await db
    .select({ name: bucket.name })
    .from(bucket)
    .where(eq(bucket.name, bucketName))
    .limit(1)
  if (exists.length === 0) return [false, []]

  const [positions, probe, records, flagRows] = await Promise.all([
    db
      .select({ position: word.position })
      .from(word)
      .where(eq(word.bucketName, bucketName))
      .orderBy(word.position),
    getProgress(bucketName),
    db
      .select({
        round: roundRecord.round,
        startedAt: roundRecord.startedAt,
        endedAt: roundRecord.endedAt,
      })
      .from(roundRecord)
      .where(eq(roundRecord.bucketName, bucketName)),
    db
      .select({ round: roundFlag.round, position: roundFlag.position })
      .from(roundFlag)
      .where(eq(roundFlag.bucketName, bucketName)),
  ])
  const wordCount = positions.length
  const spanOf = new Map(records.map((record) => [record.round, record]))
  // The table stores word positions; the timeline speaks in ordinals (the
  // deck's card order). A flag whose word no longer exists is skipped rather
  // than painted into a neighbour's column.
  const ordinalOf = new Map(positions.map((row, ordinal) => [row.position, ordinal]))
  const flagsOf = new Map<number, number[]>()
  for (const flag of flagRows) {
    const ordinal = ordinalOf.get(flag.position)
    if (ordinal === undefined) continue
    const ordinals = flagsOf.get(flag.round)
    if (ordinals) ordinals.push(ordinal)
    else flagsOf.set(flag.round, [ordinal])
  }
  for (const ordinals of flagsOf.values()) ordinals.sort((a, b) => a - b)

  const rows: RoundRow[] = []
  for (let round = probe.round; round >= 1; round--) {
    const done = round < probe.round
    const span = spanOf.get(round)
    rows.push({
      round,
      done,
      wordCount,
      // The probe's pointer is the index of the card it is parked on, so the
      // reached cards are pointer + 1 — and a probe that never settled
      // (roundStartedAt 0) has reached none. A finished round reached all.
      swept: done ? wordCount : sweptOf(probe, wordCount),
      flags: flagsOf.get(round) ?? [],
      startedAt: span ? span.startedAt : done ? 0 : probe.roundStartedAt,
      endedAt: span?.endedAt ?? null,
    })
  }
  return [true, rows]
}

/** Cards the live round has reached; see the pointer note above. */
function sweptOf(probe: ProgressRow, wordCount: number): number {
  if (probe.roundStartedAt === 0) return 0
  return Math.min(probe.pointer + 1, wordCount)
}

/**
 * Flags a word within one round: an INSERT when marking, a DELETE when
 * clearing (the row's absence IS the unflagged state). Touches round_flag
 * only — the probe belongs to settling and completing, nothing else.
 */
export async function setRoundFlag(
  bucketName: string,
  round: number,
  position: number,
  flagged: boolean,
): Promise<void> {
  const db = await getDb()
  if (flagged) {
    await db
      .insert(roundFlag)
      .values({ bucketName, round, position, flaggedAt: Date.now() })
      // Re-marking an already flagged word keeps its first stamp.
      .onConflictDoNothing()
    return
  }
  await db
    .delete(roundFlag)
    .where(
      and(
        eq(roundFlag.bucketName, bucketName),
        eq(roundFlag.round, round),
        eq(roundFlag.position, position),
      ),
    )
}

/** How many flag rows one round carries — the home review entry's count and
 * the empty check behind it. */
export async function countRoundFlags(bucketName: string, round: number): Promise<number> {
  const db = await getDb()
  const rows = await db
    .select({ n: count() })
    .from(roundFlag)
    .where(and(eq(roundFlag.bucketName, bucketName), eq(roundFlag.round, round)))
  return rows[0]?.n ?? 0
}

/** The bucket's words with their flag state IN one round — the deck's words
 * for study and browse. The join is a left one: the flag row's absence is the
 * unflagged state. */
export async function getWordsWithRoundFlag(
  bucketName: string,
  round: number,
): Promise<[boolean, RoundWordRow[]]> {
  const db = await getDb()
  const exists = await db
    .select({ name: bucket.name })
    .from(bucket)
    .where(eq(bucket.name, bucketName))
    .limit(1)
  if (exists.length === 0) return [false, []]
  const rows = await db
    .select({
      position: word.position,
      word: word.word,
      ipa: word.ipa,
      meaning: word.meaning,
      forms: word.forms,
      flagPosition: roundFlag.position,
    })
    .from(word)
    .leftJoin(
      roundFlag,
      and(
        eq(roundFlag.bucketName, word.bucketName),
        eq(roundFlag.round, round),
        eq(roundFlag.position, word.position),
      ),
    )
    .where(eq(word.bucketName, bucketName))
    .orderBy(word.position)
  return [
    true,
    rows.map((row) => ({
      position: row.position,
      word: row.word,
      ipa: row.ipa,
      meaning: row.meaning,
      forms: JSON.parse(row.forms) as string[],
      flagged: row.flagPosition !== null,
    })),
  ]
}
