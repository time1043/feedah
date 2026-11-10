import { eq, isNotNull, isNull } from 'drizzle-orm'

import type { Distractor } from '@/types/bucket'

import { getDb } from '../index'
import { bucket, word } from '../schema/bucket-word'
import { bucketProgress, roundFlag } from '../schema/study-round'
import { BUNDLED_BUCKET_NAMES } from '../seed'

export type BucketRow = {
  name: string
  wordCount: number
}

/** Every live (untombstoned) bucket, ordered by name. */
export async function getBuckets(): Promise<BucketRow[]> {
  const db = await getDb()
  return db
    .select({ name: bucket.name, wordCount: bucket.wordCount })
    .from(bucket)
    .where(isNull(bucket.deletedAt))
    .orderBy(bucket.name)
}

export type WordRow = {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
  /** The curated confusables; an empty array when the seed carries none. */
  distractors: Distractor[]
}

/** The first card number of one bucket — null when the bucket is missing or
 * has no words. A dedicated read: the home box needs one number, not the whole
 * list. */
export async function getFirstPosition(bucketName: string): Promise<number | null> {
  const db = await getDb()
  const rows = await db
    .select({ position: word.position })
    .from(word)
    .where(eq(word.bucketName, bucketName))
    .orderBy(word.position)
    .limit(1)
  return rows[0]?.position ?? null
}

/** One bucket's study readout for the launcher surfaces: the probe's round
 * and pointer plus the live round's flag count. */
export type BucketCard = {
  name: string
  round: number
  pointer: number
  wordCount: number
  flagCount: number
}

export async function getBucketCards(): Promise<BucketCard[]> {
  const db = await getDb()
  const rows = await db
    .select({
      name: bucket.name,
      wordCount: bucket.wordCount,
      round: bucketProgress.round,
      pointer: bucketProgress.pointer,
    })
    .from(bucket)
    .leftJoin(bucketProgress, eq(bucketProgress.bucketName, bucket.name))
    .where(isNull(bucket.deletedAt))
    .orderBy(bucket.name)
  // The flag rows are counted against each bucket's LIVE round in TS: a
  // bucket without a probe row is already studying round 1, and its round-1
  // flags count too.
  const flagRows = await db
    .select({ bucketName: roundFlag.bucketName, round: roundFlag.round })
    .from(roundFlag)
  const flagsOf = new Map<string, number>()
  for (const row of flagRows) {
    const key = `${row.bucketName}:${row.round}`
    flagsOf.set(key, (flagsOf.get(key) ?? 0) + 1)
  }
  return rows.map((row) => ({
    name: row.name,
    round: row.round ?? 1,
    pointer: row.pointer ?? 0,
    wordCount: row.wordCount,
    flagCount: flagsOf.get(`${row.name}:${row.round ?? 1}`) ?? 0,
  }))
}

/**
 * Soft-deletes a bucket: the tombstone hides it from every list, while its
 * words, probe, flags, sessions and statistics stay — deleting is a book-
 * keeping gesture, not a data one. Re-importing the same file (or the
 * restore path for the bundled buckets) lifts the tombstone.
 */
export async function deleteBucket(bucketName: string): Promise<void> {
  const db = await getDb()
  await db.update(bucket).set({ deletedAt: Date.now() }).where(eq(bucket.name, bucketName))
}

/** The tombstoned bundled buckets, for the restore section of the settings. */
export async function tombstonedBuckets(): Promise<string[]> {
  const db = await getDb()
  const rows = await db
    .select({ name: bucket.name })
    .from(bucket)
    .where(isNotNull(bucket.deletedAt))
    .orderBy(bucket.name)
  const bundled = new Set(BUNDLED_BUCKET_NAMES)
  return rows.filter((row) => bundled.has(row.name)).map((row) => row.name)
}

/** Lifts the tombstones of the given buckets: they reappear with their full
 * history. Pure recovery — the caller needs no confirmation. */
export async function restoreBuckets(bucketNames: string[]): Promise<void> {
  const db = await getDb()
  for (const name of bucketNames) {
    await db.update(bucket).set({ deletedAt: null }).where(eq(bucket.name, name))
  }
}
