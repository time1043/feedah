import * as SQLite from 'expo-sqlite'

import raw370 from '../../data/370.json'
import raw700 from '../../data/700.json'
import raw2050 from '../../data/2050.json'

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
 * SELECT and a changed one is fully replaced inside a transaction. This
 * logic survives the drizzle stage verbatim — only the statements swap.
 * Takes the OPEN handle: prepareDb runs inside getDb, and re-entering
 * getDb here would recurse forever (the singleton isn't set yet).
 */
export async function seedBuckets(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const file of SEED_FILES) {
    const hash = contentHashOf(file.words)
    const existing = await db.getFirstAsync<{ word_count: number; content_hash: string }>(
      'SELECT word_count, content_hash FROM bucket WHERE name = ?',
      file.name,
    )
    if (existing && existing.word_count === file.words.length && existing.content_hash === hash) {
      continue
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT OR REPLACE INTO bucket (name, word_count, content_hash) VALUES (?, ?, ?)',
        file.name,
        file.words.length,
        hash,
      )
      // A re-seed replaces the words wholesale.
      await db.runAsync('DELETE FROM word WHERE bucket_name = ?', file.name)
      for (const w of file.words) {
        await db.runAsync(
          'INSERT INTO word (bucket_name, position, word, ipa, meaning, forms) VALUES (?, ?, ?, ?, ?, ?)',
          file.name,
          w.position,
          w.word,
          w.ipa,
          w.meaning,
          JSON.stringify(w.forms),
        )
      }
    })
  }
}
