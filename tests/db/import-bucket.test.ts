//
// The import pipeline: strict parsing with readable errors, and the same
// upsert semantics as the bundled seed — progress survives a re-import,
// and importing a deleted bucket is the restore gesture.
//

/* eslint-disable no-require-imports -- the mock factories must resolve the
   harness lazily: a factory cannot safely touch module-scope bindings, so
   require() inside the factory is the correct idiom. */

import { importBucketFile, parseBucketJson } from '@/db/import-bucket'
// Typed by the real modules, resolved to the harness at runtime.
import { getDb } from '@/db/index'
import { deleteBucket, getBuckets } from '@/db/repo/bucket-word'
import { getProgress, getWordsWithRoundFlag, settleCard } from '@/db/repo/study-round'
import { seedBuckets } from '@/db/seed'

import { resetDb } from './harness'

jest.mock('@/db/index', () => require('./harness').dbIndex())
jest.mock('@/db/client', () => require('./harness').dbClient())

const VALID = JSON.stringify({
  name: 'imported',
  words: [
    { position: 1, word: 'alpha', ipa: '/a/', meaning: 'm1', forms: ['alphas'] },
    { position: 2, word: 'beta', meaning: 'm2' },
  ],
})

beforeEach(async () => {
  resetDb()
  const db = await getDb()
  await seedBuckets(db)
})

describe('parseBucketJson', () => {
  it('parses a valid file and fills the defaults', () => {
    const file = parseBucketJson(VALID)
    expect(file.name).toBe('imported')
    expect(file.words).toEqual([
      { position: 1, word: 'alpha', ipa: '/a/', meaning: 'm1', forms: ['alphas'], distractors: [] },
      { position: 2, word: 'beta', ipa: '', meaning: 'm2', forms: [], distractors: [] },
    ])
  })

  it('rejects broken files with readable messages', () => {
    expect(() => parseBucketJson('not json')).toThrow('not valid JSON')
    expect(() => parseBucketJson('[]')).toThrow('one bucket object')
    expect(() => parseBucketJson('{"words": []}')).toThrow('missing the bucket name')
    expect(() =>
      parseBucketJson('{"name": "a/b", "words": [{"position": 1, "word": "w"}]}'),
    ).toThrow('cannot contain "/"')
    expect(() => parseBucketJson('{"name": "x", "words": []}')).toThrow('no words')
  })

  it('rejects bad word rows', () => {
    const wordRow = (over: Record<string, unknown>) =>
      JSON.stringify({ name: 'x', words: [{ position: 1, word: 'w', meaning: 'm', ...over }] })
    expect(() => parseBucketJson(wordRow({ position: 'a' }))).toThrow(
      '"position" must be a positive integer',
    )
    expect(() => parseBucketJson(wordRow({ position: -1 }))).toThrow(
      '"position" must be a positive integer',
    )
    expect(() => parseBucketJson(wordRow({ word: '' }))).toThrow(
      '"word" must be a non-empty string',
    )
    expect(() =>
      parseBucketJson(
        JSON.stringify({
          name: 'x',
          words: [
            { position: 1, word: 'a' },
            { position: 1, word: 'b' },
          ],
        }),
      ),
    ).toThrow('duplicate position 1')
    expect(() =>
      parseBucketJson(
        JSON.stringify({
          name: 'x',
          words: [{ position: 1, word: 'a', distractors: [{ word: 'b' }] }],
        }),
      ),
    ).toThrow('each distractor needs')
  })
})

describe('importBucketFile', () => {
  it('imports the bucket with its words', async () => {
    await importBucketFile(parseBucketJson(VALID))
    const words = (await getWordsWithRoundFlag('imported', 1))[1]
    expect(words.map((w) => w.word)).toEqual(['alpha', 'beta'])
    expect((await getProgress('imported')).round).toBe(1)
  })

  it('re-imports when the content changes, preserving study progress', async () => {
    await importBucketFile(parseBucketJson(VALID))
    await settleCard('imported', 1)
    expect((await getProgress('imported')).pointer).toBe(1)

    const changed = JSON.stringify({
      name: 'imported',
      words: [
        { position: 1, word: 'alpha2', ipa: '', meaning: 'm1 (fixed)', forms: [] },
        { position: 2, word: 'beta', ipa: '', meaning: 'm2', forms: [] },
      ],
    })
    await importBucketFile(parseBucketJson(changed))

    const words = (await getWordsWithRoundFlag('imported', 1))[1]
    expect(words.map((w) => w.word)).toEqual(['alpha2', 'beta'])
    // Study progress survives the word refresh.
    expect((await getProgress('imported')).pointer).toBe(1)
  })

  it('importing a deleted bucket restores it', async () => {
    await importBucketFile(parseBucketJson(VALID))
    await settleCard('imported', 1)
    await deleteBucket('imported')
    expect((await getBuckets()).find((row) => row.name === 'imported')).toBeUndefined()

    await importBucketFile(parseBucketJson(VALID))

    // The tombstone lifted: the bucket is back with its progress.
    expect((await getBuckets()).find((row) => row.name === 'imported')).toMatchObject({
      name: 'imported',
    })
    expect((await getProgress('imported')).pointer).toBe(1)
  })
})
