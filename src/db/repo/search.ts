import { and, eq, sql } from 'drizzle-orm'

import type { Word } from '@/types/bucket'

import { getDb } from '../index'
import { word } from '../schema/bucket-word'

export type SearchResult = Word & { bucketName: string }

/**
 * Translates user input into a SQL LIKE pattern. A plain query is wrapped as
 * a contains-match with its `%` and `_` escaped — the characters are
 * literals, so "50%" finds "50%" and not "50x". Wildcard search (a query
 * that intends SQL semantics) arrives with this feature's second step.
 */
function toLikePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}

/**
 * Case-insensitive lookup over the word, its inflected forms (a JSON column
 * LIKE'd as text — the row returned is always the headword) and the Chinese
 * meaning, within one bucket.
 */
export async function searchWords(bucketName: string, query: string): Promise<SearchResult[]> {
  const db = await getDb()
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const pattern = toLikePattern(trimmed)
  const rows = await db
    .select()
    .from(word)
    .where(
      and(
        eq(word.bucketName, bucketName),
        sql`lower(${word.word}) LIKE lower(${pattern}) ESCAPE '\\'
      OR lower(${word.forms}) LIKE lower(${pattern}) ESCAPE '\\'
      OR lower(${word.meaning}) LIKE lower(${pattern}) ESCAPE '\\'`,
      ),
    )
    .orderBy(word.position)
    .limit(100)
  return rows.map((row) => ({
    position: row.position,
    word: row.word,
    ipa: row.ipa,
    meaning: row.meaning,
    forms: JSON.parse(row.forms) as string[],
    distractors: row.distractors ?? [],
    bucketName: row.bucketName,
  }))
}
