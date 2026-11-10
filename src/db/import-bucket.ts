import { eq } from 'drizzle-orm'

import { getDb, withTransaction } from './index'
import { bucket } from './schema/bucket-word'
import { contentHashOf, seedBucketsFrom, type SeedFile, type SeedWord } from './seed'

export { contentHashOf, type SeedFile, type SeedWord } from './seed'

/**
 * Parses and validates an imported bucket JSON file. The shape matches the
 * bundled data/*.json files: `{ name, words: [{ position, word, ipa,
 * meaning, forms, distractors? }] }`. Throws with a readable message on
 * anything that would produce a broken bucket.
 */
export function parseBucketJson(text: string): SeedFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Expected one bucket object: { "name": …, "words": […] }.')
  }
  const { name, words } = raw as { name?: unknown; words?: unknown }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('The file is missing the bucket name.')
  }
  const bucketName = name.trim()
  if (bucketName.includes('/')) {
    throw new Error('The bucket name cannot contain "/".')
  }
  if (bucketName.length > 40) {
    throw new Error('The bucket name is too long (40 characters max).')
  }
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('The file has no words.')
  }

  const seenPositions = new Set<number>()
  const parsedWords: SeedWord[] = words.map((rawWord, index) => {
    const where = `Word ${index + 1}`
    if (typeof rawWord !== 'object' || rawWord === null) {
      throw new Error(`${where}: expected an object.`)
    }
    const record = rawWord as Record<string, unknown>
    const position = record.position
    if (typeof position !== 'number' || !Number.isInteger(position) || position <= 0) {
      throw new Error(`${where}: "position" must be a positive integer.`)
    }
    if (seenPositions.has(position)) {
      throw new Error(`${where}: duplicate position ${position}.`)
    }
    seenPositions.add(position)
    if (typeof record.word !== 'string' || record.word.trim().length === 0) {
      throw new Error(`${where}: "word" must be a non-empty string.`)
    }
    if (record.meaning !== undefined && typeof record.meaning !== 'string') {
      throw new Error(`${where}: "meaning" must be a string.`)
    }
    if (record.ipa !== undefined && typeof record.ipa !== 'string') {
      throw new Error(`${where}: "ipa" must be a string.`)
    }
    if (record.forms !== undefined && !Array.isArray(record.forms)) {
      throw new Error(`${where}: "forms" must be an array of strings.`)
    }
    if (record.distractors !== undefined) {
      if (!Array.isArray(record.distractors)) {
        throw new Error(`${where}: "distractors" must be an array.`)
      }
      for (const distractor of record.distractors) {
        if (
          typeof distractor !== 'object' ||
          distractor === null ||
          typeof (distractor as Record<string, unknown>).word !== 'string' ||
          typeof (distractor as Record<string, unknown>).meaning !== 'string'
        ) {
          throw new Error(`${where}: each distractor needs "word" and "meaning".`)
        }
      }
    }
    return {
      position,
      word: record.word,
      ipa: typeof record.ipa === 'string' ? record.ipa : '',
      meaning: typeof record.meaning === 'string' ? record.meaning : '',
      forms: Array.isArray(record.forms) ? record.forms.filter((f) => typeof f === 'string') : [],
      distractors: Array.isArray(record.distractors)
        ? record.distractors.filter(
            (d): d is { word: string; meaning: string } =>
              typeof d === 'object' &&
              d !== null &&
              typeof (d as { word?: unknown }).word === 'string' &&
              typeof (d as { meaning?: unknown }).meaning === 'string',
          )
        : [],
    }
  })

  return { name: bucketName, words: parsedWords }
}

/**
 * Imports (or replaces) a user bucket: same upsert semantics as the bundled
 * seed — an unchanged bucket is skipped, a changed one has its words
 * replaced while study progress is preserved. Importing a deleted bucket is
 * the explicit restore gesture: the tombstone lifts and the bucket returns
 * with its full history.
 */
export async function importBucketFile(file: SeedFile): Promise<void> {
  const db = await getDb()
  await withTransaction(async () => {
    await db.update(bucket).set({ deletedAt: null }).where(eq(bucket.name, file.name))
    await seedBucketsFrom(db, [file])
  })
}
