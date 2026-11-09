import { getDb } from './index'

export type BucketRow = {
  name: string
  wordCount: number
}

/** Every seeded bucket, ordered by name. The reference's readout (round,
 * pointer, flags) joins in once the probe lives here too. */
export async function getBuckets(): Promise<BucketRow[]> {
  const db = await getDb()
  return db.getAllAsync<BucketRow>('SELECT name, word_count AS wordCount FROM bucket ORDER BY name')
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
  const exists = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM bucket WHERE name = ?',
    bucketName,
  )
  if (!exists) return [false, []]
  const rows = await db.getAllAsync<{
    position: number
    word: string
    ipa: string
    meaning: string
    forms: string
  }>(
    'SELECT position, word, ipa, meaning, forms FROM word WHERE bucket_name = ? ORDER BY position',
    bucketName,
  )
  return [true, rows.map((row) => ({ ...row, forms: JSON.parse(row.forms) as string[] }))]
}
