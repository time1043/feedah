import { and, eq, sql } from 'drizzle-orm'

import type { Word } from '@/types/bucket'

import { getDb } from '../index'
import { word } from '../schema/bucket-word'

export type SearchResult = Word & { bucketName: string }

/**
 * Translates user input into a SQL LIKE pattern, matching SQL semantics:
 *   %  any run of zero or more characters
 *   _  exactly one character
 * A query with no wildcard characters is escaped and wrapped as a
 * contains-match, so its % and _ stay literals — "50%" finds "50%".
 * Examples: `ter%` matches words starting with ter, `%ter` ending with
 * ter, `wo%rd` exactly starting with wo and ending with rd.
 */
function toLikePattern(query: string): string {
  if (/[%_]/.test(query)) return query
  return `%${query.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}

/**
 * Case-insensitive lookup over the word, its inflected forms (a JSON column
 * LIKE'd as text — the row returned is always the headword) and the Chinese
 * meaning, within one bucket. `|` splits the query into alternatives whose
 * results are unioned (`scene|sense`), each keeping the %/_ rules.
 */
export async function searchWords(bucketName: string, query: string): Promise<SearchResult[]> {
  const db = await getDb()
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const alternatives = trimmed
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  const parts = alternatives.length > 0 ? alternatives : [trimmed]
  const conditions = parts.map(
    (part) =>
      sql`lower(${word.word}) LIKE lower(${toLikePattern(part)}) ESCAPE '\\'
      OR lower(${word.forms}) LIKE lower(${toLikePattern(part)}) ESCAPE '\\'
      OR lower(${word.meaning}) LIKE lower(${toLikePattern(part)}) ESCAPE '\\'`,
  )
  const rows = await db
    .select()
    .from(word)
    .where(and(eq(word.bucketName, bucketName), sql.join(conditions, sql` OR `)))
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
