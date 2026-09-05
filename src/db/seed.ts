import { eq, sql } from 'drizzle-orm';

import raw370 from '../../data/370.json';
import raw2050 from '../../data/2050.json';
import raw700 from '../../data/700.json';

import { withTransaction, type Db } from './index';
import { bucket, bucketProgress, word } from './schema';

export type SeedWord = {
  position: number;
  word: string;
  ipa: string;
  meaning: string;
  forms: string[];
};

type SeedFile = { name: string; words: SeedWord[] };

// Each bucket JSON is imported above and listed here, then bundled into the app
// at build time. Seeding runs on the first DB open (getDb in src/db/index.ts)
// and on every later cold start; it is idempotent against the device's stored
// bucket.word_count, so an APK rebuild that changes a bucket's word count
// re-seeds that bucket on the user's device (flags reset), while an unchanged
// bundle leaves existing data untouched.
export const BUNDLED_BUCKETS = [raw2050, raw700, raw370] as SeedFile[];

export const DEFAULT_BUCKET_ID = '2050';

// Rows per batched INSERT; keeps the statement far below SQLite's bound
// parameter limit (2050 words x 6 columns would exceed older ones).
const SEED_CHUNK = 500;

/** Idempotent: inserts missing buckets, refreshes words when the data changed. */
export async function seedBuckets(db: Db): Promise<void> {
  for (const file of BUNDLED_BUCKETS) {
    const existing = await db
      .select({ wordCount: bucket.wordCount })
      .from(bucket)
      .where(eq(bucket.id, file.name))
      .get();

    if (existing && existing.wordCount === file.words.length) {
      await db
        .insert(bucketProgress)
        .values({ bucketId: file.name })
        .onConflictDoNothing({ target: bucketProgress.bucketId });
      continue;
    }

    await withTransaction(async (tx) => {
      await tx
        .insert(bucket)
        .values({ id: file.name, wordCount: file.words.length })
        .onConflictDoUpdate({ target: bucket.id, set: { wordCount: file.words.length } });
      if (existing) {
        await tx.delete(word).where(eq(word.bucketId, file.name));
      }
      for (let i = 0; i < file.words.length; i += SEED_CHUNK) {
        const rows = file.words.slice(i, i + SEED_CHUNK).map((w) => ({
          bucketId: file.name,
          position: w.position,
          text: w.word,
          ipa: w.ipa,
          meaning: w.meaning,
          forms: w.forms,
          flagged: false,
        }));
        await tx
          .insert(word)
          .values(rows)
          .onConflictDoUpdate({
            target: [word.bucketId, word.position],
            set: {
              text: sql`excluded.text`,
              ipa: sql`excluded.ipa`,
              meaning: sql`excluded.meaning`,
              forms: sql`excluded.forms`,
              flagged: sql`excluded.flagged`,
            },
          });
      }
      await tx
        .insert(bucketProgress)
        .values({ bucketId: file.name })
        .onConflictDoNothing({ target: bucketProgress.bucketId });
    });
  }
}
