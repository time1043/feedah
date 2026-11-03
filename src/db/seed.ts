import { eq } from 'drizzle-orm'

import type { Db } from './index'

import raw370 from '../../data/370.json'
import raw700 from '../../data/700.json'
import raw2050 from '../../data/2050.json'
import { bucket, word } from './schema'

export type SeedDistractor = { word: string; meaning: string }

export type SeedWord = {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
  distractors?: SeedDistractor[]
}

export type SeedFile = { name: string; words: SeedWord[] }

// Each bucket JSON is imported here and bundled into the app at build time.
// Seeding runs on the first DB open and on every later cold start; it is
// idempotent against the stored bucket.word_count + content hash, so a
// bundle that changes a bucket's words OR its data-only fields (e.g.
// distractors) re-seeds that bucket on the device, while an unchanged
// bundle leaves existing data untouched.
const BUNDLED_BUCKETS = [raw2050, raw370, raw700] as SeedFile[]

/** The ids the app bundles — the restore path un-tombstones exactly these. */
export const BUNDLED_BUCKET_IDS = BUNDLED_BUCKETS.map((file) => file.name)

// Rows per batched INSERT; keeps the statement far below SQLite's bound
// parameter limit once a bucket holds thousands of words.
const SEED_CHUNK = 500

/** Stable short hash (djb2) of the serialized word content. */
export function contentHash(words: SeedWord[]): string {
  const json = JSON.stringify(words)
  let hash = 5381
  for (let i = 0; i < json.length; i++) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16)
}

/** Idempotent: inserts missing buckets, refreshes words when the data changed. */
export async function seedBuckets(
  db: Db,
  withTransaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>,
): Promise<void> {
  await seedBucketsFrom(db, withTransaction, BUNDLED_BUCKETS)
}

export async function seedBucketsFrom(
  db: Db,
  withTransaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>,
  files: SeedFile[],
): Promise<void> {
  for (const file of files) {
    const hash = contentHash(file.words)
    const existing = await db
      .select({
        wordCount: bucket.wordCount,
        contentHash: bucket.contentHash,
        deletedAt: bucket.deletedAt,
      })
      .from(bucket)
      .where(eq(bucket.id, file.name))
      .get()
    // A tombstoned bucket stays deleted: even a changed bundled file must
    // not resurrect it (the check sits before the hash comparison).
    if (existing && existing.deletedAt !== null) continue
    if (existing && existing.wordCount === file.words.length && existing.contentHash === hash) {
      continue
    }

    await withTransaction(async (tx) => {
      await tx
        .insert(bucket)
        .values({ id: file.name, wordCount: file.words.length, contentHash: hash })
        .onConflictDoUpdate({
          target: bucket.id,
          set: { wordCount: file.words.length, contentHash: hash },
        })
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
            distractors: w.distractors ?? [],
          })),
        )
      }
    })
  }
}
