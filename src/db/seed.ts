import { eq } from 'drizzle-orm'

import type { Db } from './index'

import raw370 from '../../data/370.json'
import raw700 from '../../data/700.json'
import raw2050 from '../../data/2050.json'
import { bucket, word } from './schema'

export type SeedWord = {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
}

export type SeedFile = { name: string; words: SeedWord[] }

// Each bucket JSON is imported here and bundled into the app at build time.
// Seeding runs on the first DB open and on every later cold start; it is
// idempotent against the stored bucket.word_count, so a bundle that changes
// a bucket's word count re-seeds that bucket on the device, while an
// unchanged bundle leaves existing data untouched.
export const BUNDLED_BUCKETS = [raw2050, raw370, raw700] as SeedFile[]

// Rows per batched INSERT; keeps the statement far below SQLite's bound
// parameter limit once a bucket holds thousands of words.
const SEED_CHUNK = 500

export type TxRunner = <T>(fn: (tx: Db) => Promise<T>) => Promise<T>

/** Idempotent: inserts missing buckets, refreshes words when the data changed. */
export async function seedBuckets(db: Db, txRunner?: TxRunner): Promise<void> {
  const runTx = txRunner ?? (async (fn) => fn(db))
  for (const file of BUNDLED_BUCKETS) {
    const existing = await db
      .select({ wordCount: bucket.wordCount })
      .from(bucket)
      .where(eq(bucket.id, file.name))
      .get()
    if (existing && existing.wordCount === file.words.length) continue

    await runTx(async (tx) => {
      await tx
        .insert(bucket)
        .values({ id: file.name, wordCount: file.words.length })
        .onConflictDoUpdate({ target: bucket.id, set: { wordCount: file.words.length } })
      if (existing) {
        await tx.delete(word).where(eq(word.bucketId, file.name))
      }
      for (let i = 0; i < file.words.length; i += SEED_CHUNK) {
        await tx.insert(word).values(
          file.words.slice(i, i + SEED_CHUNK).map((w) => ({
            bucketId: file.name,
            position: w.position,
            text: w.word,
            ipa: w.ipa,
            meaning: w.meaning,
            forms: w.forms,
          })),
        )
      }
    })
  }
}
