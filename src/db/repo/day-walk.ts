import { and, eq, gte, lte } from 'drizzle-orm'

import type { Word } from '@/types/bucket'

import { todayLocalDate } from '@/lib/date'

import { getDb } from '../index'
import { bucket, word } from '../schema/bucket-word'
import { dailyPointer } from '../schema/daily'
import { roundFlag } from '../schema/study-round'

/** One entry of a day walk: the word, its bucket, the round it was walked
 * in and that round's flag state — the same word may appear under several
 * rounds of one day, flagged differently in each. */
export type DayWord = Word & { bucketName: string; round: number; flagged: boolean }

function mapWord(row: {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string
  distractors: unknown
}): Word {
  return {
    position: row.position,
    word: row.word,
    ipa: row.ipa,
    meaning: row.meaning,
    forms: JSON.parse(row.forms) as string[],
    distractors: (row.distractors as Word['distractors']) ?? [],
  }
}

/** The bucket's words keyed by position and its word count, fetched once
 * and reused across ranges (rounds repeat positions; the word itself does
 * not change). The ordinals decode against the position-ordered list —
 * word positions are arbitrary numbers (2050 starts at 1701). */
type BucketEntry = { wordCount: number; positions: number[]; words: Map<number, Word> }

async function bucketEntry(
  db: Awaited<ReturnType<typeof getDb>>,
  bucketName: string,
  cache: Map<string, BucketEntry>,
): Promise<BucketEntry> {
  let entry = cache.get(bucketName)
  if (!entry) {
    const [countRows, wordRows] = await Promise.all([
      db
        .select({ wordCount: bucket.wordCount })
        .from(bucket)
        .where(eq(bucket.name, bucketName))
        .limit(1),
      db.select().from(word).where(eq(word.bucketName, bucketName)).orderBy(word.position),
    ])
    entry = {
      wordCount: countRows[0]?.wordCount ?? 0,
      positions: wordRows.map((row) => row.position),
      words: new Map(wordRows.map((row) => [row.position, mapWord(row)])),
    }
    cache.set(bucketName, entry)
  }
  return entry
}

/**
 * The words studied on a local day, across all buckets, in study order —
 * rebuilt from the daily pointer high-water marks: the day's globalPosition
 * gain over the previous recorded snapshot names exactly the cards settled
 * that day (the same rule the stats word counts use, so the queue always
 * matches the number). A global position encodes (round, 1-based ordinal)
 * against the bucket's word count, and the ordinal maps back to the word
 * through the position-ordered list, so a day spanning several rounds of
 * one bucket contributes every round's stretch — the same word appears once
 * per round it was walked in, deliberately without dedup. Rows carry their
 * bucket name (a day walk spans buckets).
 */
export async function getWordsCompletedOn(day: string): Promise<DayWord[]> {
  const db = await getDb()
  const pointers = await db
    .select()
    .from(dailyPointer)
    .orderBy(dailyPointer.bucketName, dailyPointer.day)
  const previousByBucket = new Map<string, number>()
  const ranges: { bucketName: string; from: number; to: number }[] = []
  for (const row of pointers) {
    if (row.day === day) {
      const from = (previousByBucket.get(row.bucketName) ?? 0) + 1
      if (row.globalPosition >= from) {
        ranges.push({ bucketName: row.bucketName, from, to: row.globalPosition })
      }
    }
    previousByBucket.set(row.bucketName, row.globalPosition)
  }

  const buckets = new Map<string, BucketEntry>()
  const out: DayWord[] = []
  for (const range of ranges) {
    const entry = await bucketEntry(db, range.bucketName, buckets)
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
          eq(roundFlag.bucketName, range.bucketName),
          gte(roundFlag.round, firstRound),
          lte(roundFlag.round, lastRound),
        ),
      )
    const flagged = new Set(flagRows.map((row) => `${row.round}:${row.position}`))
    for (let global = range.from; global <= range.to; global++) {
      const round = Math.floor((global - 1) / entry.wordCount) + 1
      const ordinal = ((global - 1) % entry.wordCount) + 1
      const position = entry.positions[ordinal - 1]
      const found = position !== undefined ? entry.words.get(position) : undefined
      if (found) {
        out.push({
          ...found,
          bucketName: range.bucketName,
          round,
          flagged: flagged.has(`${round}:${position}`),
        })
      }
    }
  }
  return out
}

/**
 * The words flagged on a local day, across all buckets and rounds — one
 * entry per round_flag row, so a word flagged in several rounds of one day
 * appears once per flag (no dedup, like the day walk). Ordered by round
 * first, flag time within: rounds get revisited (a round's review walk can
 * flag more words long after later rounds were studied), and a replay that
 * bounced round 1 → 2 → 1 must still walk round 1 in one pass. Every entry
 * is currently flagged: unflagging deletes the row, leaving nothing to
 * review.
 */
export async function getWordsFlaggedOn(day: string): Promise<DayWord[]> {
  const db = await getDb()
  const flags = await db
    .select()
    .from(roundFlag)
    .orderBy(roundFlag.bucketName, roundFlag.round, roundFlag.flaggedAt)
  // Local-date filtering in TS: flaggedAt → local day, immune to DST and
  // UTC shifts. The flag table is sparse (one row per live flag), so the
  // scan is cheap.
  const ofDay = flags.filter((row) => todayLocalDate(new Date(row.flaggedAt)) === day)

  const buckets = new Map<string, BucketEntry>()
  const out: DayWord[] = []
  for (const flag of ofDay) {
    const entry = await bucketEntry(db, flag.bucketName, buckets)
    const found = entry.words.get(flag.position)
    if (found) {
      out.push({ ...found, bucketName: flag.bucketName, round: flag.round, flagged: true })
    }
  }
  return out
}
