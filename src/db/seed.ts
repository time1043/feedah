import { eq } from 'drizzle-orm'

import { buckets } from '@/mock/data'

import type { Db } from './index'

import { bucket, word } from './schema'

/**
 * Seeds bundled buckets into the database. Idempotent: a bucket is re-seeded
 * only when it is missing or its word count changed (a data update) — study
 * state is never touched.
 */
export async function seedBuckets(db: Db): Promise<void> {
  for (const data of buckets) {
    const row = await db.select().from(bucket).where(eq(bucket.id, data.name)).get()
    if (row && row.wordCount === data.words.length) continue
    await db.delete(word).where(eq(word.bucketId, data.name))
    await db.insert(word).values(
      data.words.map((w) => ({
        bucketId: data.name,
        position: w.position,
        text: w.word,
        ipa: w.ipa,
        meaning: w.meaning,
        forms: w.forms,
      })),
    )
    await db
      .insert(bucket)
      .values({ id: data.name, wordCount: data.words.length })
      .onConflictDoUpdate({ target: bucket.id, set: { wordCount: data.words.length } })
  }
}
