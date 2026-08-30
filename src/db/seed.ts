import raw370 from '../../data/370.json';
import raw2050 from '../../data/2050.json';
import raw700 from '../../data/700.json';
import type { SQLiteDatabase } from 'expo-sqlite';

export type SeedWord = {
  position: number;
  word: string;
  ipa: string;
  meaning: string;
  forms: string[];
};

type SeedFile = { name: string; words: SeedWord[] };

export const BUNDLED_BUCKETS = [raw2050, raw700, raw370] as SeedFile[];

export const DEFAULT_BUCKET_ID = '2050';

/** Idempotent: inserts missing buckets, refreshes words when the data changed. */
export async function seedBuckets(db: SQLiteDatabase): Promise<void> {
  for (const bucket of BUNDLED_BUCKETS) {
    const existing = await db.getFirstAsync<{ word_count: number }>(
      'SELECT word_count FROM bucket WHERE id = ?',
      [bucket.name],
    );

    if (existing && existing.word_count === bucket.words.length) {
      await db.runAsync('INSERT OR IGNORE INTO bucket_progress (bucket_id) VALUES (?)', [bucket.name]);
      continue;
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO bucket (id, word_count) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET word_count = excluded.word_count`,
        [bucket.name, bucket.words.length],
      );
      if (existing) {
        await db.runAsync('DELETE FROM word WHERE bucket_id = ?', [bucket.name]);
      }
      const statement = await db.prepareAsync(
        `INSERT OR REPLACE INTO word (bucket_id, position, text, ipa, meaning, forms, flagged)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      );
      try {
        for (const word of bucket.words) {
          await statement.executeAsync([
            bucket.name,
            word.position,
            word.word,
            word.ipa,
            word.meaning,
            JSON.stringify(word.forms),
          ]);
        }
      } finally {
        await statement.finalizeAsync();
      }
      await db.runAsync('INSERT OR IGNORE INTO bucket_progress (bucket_id) VALUES (?)', [bucket.name]);
    });
  }
}
