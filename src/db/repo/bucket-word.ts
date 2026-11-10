import { eq } from 'drizzle-orm'

import { getDb } from '../index'
import { bucket, word } from '../schema/bucket-word'

export type BucketRow = {
  name: string
  wordCount: number
}

/** Every seeded bucket, ordered by id. The reference's readout (round,
 * pointer, flags) joins in once the probe lives here too. */
export async function getBuckets(): Promise<BucketRow[]> {
  const db = await getDb()
  return db
    .select({ name: bucket.name, wordCount: bucket.wordCount })
    .from(bucket)
    .orderBy(bucket.name)
}

export type WordRow = {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
}

/**
 * The bucket's existence plus its words, ordered by position. The tuple
 * separates a missing bucket from an existing-but-empty one — the caller's
 * not-found state must not lie about which one happened.
 */
export async function getWordsByBucket(bucketName: string): Promise<[boolean, WordRow[]]> {
  const db = await getDb()
  const exists = await db
    .select({ id: bucket.name })
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
    })
    .from(word)
    .where(eq(word.bucketName, bucketName))
    .orderBy(word.position)
  return [true, rows.map((row) => ({ ...row, forms: JSON.parse(row.forms) as string[] }))]
}
