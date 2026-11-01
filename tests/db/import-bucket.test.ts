import { parseBucketJson, importBucketFile } from '@/db/import-bucket'

jest.mock('@/db/index', () => require('./harness').dbIndex())

import { getDb } from '@/db/index'
import { getProgress, getWordsWithRoundFlag, settleCard } from '@/db/repo'
import { seedBuckets } from '@/db/seed'

const VALID = JSON.stringify({
  name: 'imported',
  words: [
    { position: 1, word: 'alpha', ipa: '/a/', meaning: 'm1', forms: ['alphas'] },
    { position: 2, word: 'beta', meaning: 'm2' },
  ],
})

beforeEach(async () => {
  require('./harness').resetDb()
  const db = await getDb()
  await seedBuckets(db, require('./harness').dbIndex().withTransaction)
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
    const word = (over: Record<string, unknown>) =>
      JSON.stringify({ name: 'x', words: [{ position: 1, word: 'w', meaning: 'm', ...over }] })
    expect(() => parseBucketJson(word({ position: 'a' }))).toThrow(
      '"position" must be a positive integer',
    )
    expect(() => parseBucketJson(word({ position: -1 }))).toThrow(
      '"position" must be a positive integer',
    )
    expect(() => parseBucketJson(word({ word: '' }))).toThrow('"word" must be a non-empty string')
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
    const words = await getWordsWithRoundFlag('imported', 1)
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

    const words = await getWordsWithRoundFlag('imported', 1)
    expect(words.map((w) => w.word)).toEqual(['alpha2', 'beta'])
    // Study progress survives the word refresh.
    expect((await getProgress('imported')).pointer).toBe(1)
  })
})
