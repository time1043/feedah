import { eq } from 'drizzle-orm'

import { getDb } from '../index'
import { bucket, word } from '../schema/bucket-word'

export type BucketRow = {
  name: string
  wordCount: number
}

/** Every seeded bucket, ordered by name. */
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
