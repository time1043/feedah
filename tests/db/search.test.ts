//
// The search's matching rules, against the real migration DDL and the
// seeded 2050 bucket.
//

/* eslint-disable no-require-imports -- the mock factories must resolve the
   harness lazily: a factory cannot safely touch module-scope bindings, so
   require() inside the factory is the correct idiom. */

// Typed by the real modules, resolved to the harness at runtime.
import { eq } from 'drizzle-orm'

// Typed by the real modules, resolved to the harness at runtime.
import { getDb } from '@/db/index'
import { searchWords } from '@/db/repo/search'
import { word } from '@/db/schema/bucket-word'
import { seedBuckets } from '@/db/seed'

import { resetDb } from './harness'

jest.mock('@/db/index', () => require('./harness').dbIndex())
jest.mock('@/db/client', () => require('./harness').dbClient())

const BUCKET = '2050'

beforeEach(async () => {
  resetDb()
  const db = await getDb()
  await seedBuckets(db)
})

describe('the plain search (contains-match)', () => {
  /** One real row of the seeded bucket, so the queries ride actual data. */
  async function sampleWord() {
    const db = await getDb()
    const rows = await db.select().from(word).where(eq(word.bucketName, BUCKET)).limit(1)
    return rows[0]
  }

  it('finds a word by a substring of itself, case-insensitive', async () => {
    const sample = await sampleWord()
    const needle = sample.word.slice(0, 2)
    const results = await searchWords(BUCKET, needle.toUpperCase())
    expect(results.some((row) => row.position === sample.position)).toBe(true)
    expect(results.every((row) => row.word.toLowerCase().includes(needle.toLowerCase()))).toBe(true)
  })

  it('keeps a backslash a literal once the wildcard search lands', async () => {
    // A query holding a wildcard keeps SQL semantics (the wildcard suite
    // pins that); the escape path is what keeps a stray backslash literal.
    expect(await searchWords(BUCKET, '\\')).toHaveLength(0)
  })

  it('returns nothing for an empty query or a miss', async () => {
    expect(await searchWords(BUCKET, '   ')).toHaveLength(0)
    expect(await searchWords(BUCKET, 'zzzzqqqq')).toHaveLength(0)
  })

  it('matches inside the meaning and returns the headword', async () => {
    const sample = await sampleWord()
    const results = await searchWords(BUCKET, sample.meaning)
    expect(results.some((row) => row.position === sample.position)).toBe(true)
    // Whatever matched, the row is always the headword of its own entry.
    expect(results.every((row) => row.word.length > 0)).toBe(true)
  })
})

describe('the wildcard search', () => {
  /** One real row of the seeded bucket, so the queries ride actual data. */
  async function sampleWord() {
    const db = await getDb()
    const rows = await db.select().from(word).where(eq(word.bucketName, BUCKET)).limit(1)
    return rows[0]
  }

  it('honors % as any run and _ as exactly one character', async () => {
    const sample = await sampleWord()
    const w = sample.word.toLowerCase()
    const prefix = await searchWords(BUCKET, `${w.slice(0, 1)}%`)
    expect(prefix.some((row) => row.position === sample.position)).toBe(true)
    const suffix = await searchWords(BUCKET, `%${w.slice(-1)}`)
    expect(suffix.some((row) => row.position === sample.position)).toBe(true)
    const singles = await searchWords(BUCKET, `${w.slice(0, 1)}${'_'.repeat(w.length - 1)}`)
    expect(singles.some((row) => row.position === sample.position)).toBe(true)
  })

  it('unions | alternatives', async () => {
    const sample = await sampleWord()
    const results = await searchWords(BUCKET, `${sample.word}|zzzzqqqq`)
    expect(results.some((row) => row.position === sample.position)).toBe(true)
  })
})
