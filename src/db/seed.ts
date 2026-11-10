import { eq } from 'drizzle-orm'

import raw370 from '../../data/370.json'
import raw700 from '../../data/700.json'
import raw2050 from '../../data/2050.json'
import { withTransaction, type Db } from './client'
import { bucket, word } from './schema/bucket-word'

type SeedWord = {
  position: number
  word: string
  ipa: string
  meaning: string
  forms: string[]
}

type SeedFile = { name: string; words: SeedWord[] }

const SEED_FILES: SeedFile[] = [raw2050, raw370, raw700]

/** A deterministic content hash of the seed words: data-only changes (new
 * words, edited meanings) re-seed the bucket even when the count is equal. */
function contentHashOf(words: SeedWord[]): string {
  const json = JSON.stringify(words)
  let hash = 5381
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0
  }
  return String(hash >>> 0)
}

/**
 * Seeds the bundled buckets on every cold start; idempotent against the
 * stored bucket.word_count + content hash, so an unchanged bucket is one
 * SELECT and a changed one is fully replaced inside a transaction. The
 * statements are drizzle now — the idempotency logic is what survived the
 * raw-sqlite stage.
 */
export async function seedBuckets(db: Db): Promise<void> {
  for (const file of SEED_FILES) {
    const hash = contentHashOf(file.words)
    const existing = await db
      .select({ wordCount: bucket.wordCount, contentHash: bucket.contentHash })
      .from(bucket)
      .where(eq(bucket.name, file.name))
      .limit(1)
    if (
      existing[0] &&
      existing[0].wordCount === file.words.length &&
      existing[0].contentHash === hash
    ) {
      continue
    }

    await withTransaction(async () => {
      // An UPSERT, not INSERT OR REPLACE: with foreign_keys ON, REPLACE
      // would cascade-delete the words we are about to reseed anyway —
      // keeping the intent explicit.
      await db
        .insert(bucket)
        .values({ name: file.name, wordCount: file.words.length, contentHash: hash })
        .onConflictDoUpdate({
          target: bucket.name,
          set: { wordCount: file.words.length, contentHash: hash },
        })
      // A re-seed replaces the words wholesale.
      await db.delete(word).where(eq(word.bucketName, file.name))
      await db.insert(word).values(
        file.words.map((w) => ({
          bucketName: file.name,
          position: w.position,
          word: w.word,
          ipa: w.ipa,
          meaning: w.meaning,
          forms: JSON.stringify(w.forms),
        })),
      )
    })
  }
}
