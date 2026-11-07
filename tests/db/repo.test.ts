import { seedBuckets, seedBucketsFrom, type SeedFile } from '@/db/seed'

jest.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
jest.mock('@/db/index', () => require('./harness').dbIndex())

import { sql } from 'drizzle-orm'

import type { WordWithFlag } from '@/db/repo'

import { importBucketFile } from '@/db/import-bucket'
import { getDb } from '@/db/index'
import {
  completeRound,
  getWordsCompletedOn,
  getWordsFlaggedOn,
  countRoundFlags,
  deleteBucket,
  finishReview,
  getProgress,
  getRoundSummaries,
  getWords,
  getWordCount,
  getWordsWithRoundFlag,
  listBuckets,
  listDailyPointers,
  openReviewSession,
  recordAnswer,
  restoreBuckets,
  settleCard,
  settleReview,
  setRoundFlag,
  tombstonedBuckets,
} from '@/db/repo'
import { todayLocalDate } from '@/lib/date'
import { roundStatuses } from '@/lib/round-status'

const BUCKET = '2050'

async function seed(): Promise<void> {
  const db = await getDb()
  const { withTransaction } = require('./harness').dbIndex()
  await seedBuckets(db, withTransaction)
}

/** The bucket's word positions in deck order — flags and joins use these. */
async function wordPositions(): Promise<number[]> {
  return (await getWords(BUCKET)).map((w) => w.position)
}

/** Walks the probe through the whole round and completes it. */
async function finishFeedRound(): Promise<void> {
  const wordCount = await getWordCount(BUCKET)
  for (let i = 1; i < wordCount; i++) await settleCard(BUCKET, i)
  await completeRound(BUCKET)
}

beforeEach(async () => {
  require('./harness').resetDb()
  await seed()
})

describe('seed', () => {
  it('re-seeds a bucket when only data-only fields change', async () => {
    const db = await getDb()
    const { withTransaction } = require('./harness').dbIndex()
    const files: SeedFile[] = [
      { name: 't', words: [{ position: 1, word: 'alpha', ipa: '', meaning: 'm1', forms: [] }] },
    ]
    await seedBucketsFrom(db, withTransaction, files)
    // Same word count, different content: the hash must trigger a re-seed.
    const changed: SeedFile[] = [
      {
        name: 't',
        words: [
          {
            position: 1,
            word: 'alpha',
            ipa: '',
            meaning: 'm1',
            forms: [],
            distractors: [{ word: 'beta', meaning: 'm2' }],
          },
        ],
      },
    ]
    await seedBucketsFrom(db, withTransaction, changed)
    const words = await getWords('t')
    expect(words[0].meaning).toBe('m1')
    expect(words[0].distractors).toEqual([{ word: 'beta', meaning: 'm2' }])
  })
})

describe('answer log', () => {
  it('appends answers without touching probe, flags or sessions', async () => {
    const db = await getDb()
    await recordAnswer({
      bucketId: BUCKET,
      round: 1,
      position: 1701,
      mode: 'quiz',
      correct: true,
    })
    await recordAnswer({
      bucketId: BUCKET,
      round: 1,
      position: 1702,
      mode: 'type',
      correct: false,
    })
    const rows = await db.all('SELECT * FROM answer_log ORDER BY answered_at')
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.correct)).toEqual([1, 0])
    // No side effects on the study state.
    expect(await getProgress(BUCKET)).toMatchObject({ round: 1, pointer: 0 })
  })
})

describe('probe', () => {
  it('defaults to round 1 pointer 0 and only moves forward', async () => {
    expect(await getProgress(BUCKET)).toEqual({ round: 1, pointer: 0, roundStartedAt: 0 })
    await settleCard(BUCKET, 2)
    await settleCard(BUCKET, 1)
    expect(await getProgress(BUCKET)).toMatchObject({ round: 1, pointer: 2 })
  })

  it('advances the round in one transaction when the end card settles', async () => {
    const wordCount = await getWordCount(BUCKET)
    await finishFeedRound()
    expect(await getProgress(BUCKET)).toMatchObject({ round: 2, pointer: 0 })
    const rounds = await getRoundSummaries(BUCKET)
    expect(rounds).toHaveLength(2)
    expect(rounds[0]).toMatchObject({ round: 1, done: true, green: wordCount, red: 0 })
  })

  it("carries the finished round's flags into the next round", async () => {
    const [p1, , p3] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p3, true)
    await finishFeedRound()
    // The new round starts pre-flagged (回显), the finished one stays frozen.
    expect(await countRoundFlags(BUCKET, 2)).toBe(2)
    expect(await countRoundFlags(BUCKET, 1)).toBe(2)
  })
})

describe('the round-advance chain (user scenario)', () => {
  it('flags two words → the next round carries them; sweeping their cards turns the rest green', async () => {
    const positions = await wordPositions()
    await setRoundFlag(BUCKET, 1, positions[1], true)
    await setRoundFlag(BUCKET, 1, positions[3], true)
    await finishFeedRound()

    // The carried round: flags present, nothing swept yet — flags red,
    // everything else still gray.
    const fresh = (await getRoundSummaries(BUCKET)).find((r) => !r.done)!
    expect(fresh.pointer).toBe(0)
    expect(fresh.flags).toEqual([1, 3])
    const wordCount = await getWordCount(BUCKET)
    expect(roundStatuses(wordCount, fresh)[1]).toBe('red')

    // The user walks past position 4: the sweep turns 1,3 green.
    await settleCard(BUCKET, 1)
    await settleCard(BUCKET, 2)
    await settleCard(BUCKET, 3)
    await settleCard(BUCKET, 4)
    const current = (await getRoundSummaries(BUCKET)).find((r) => !r.done)!
    expect(current.round).toBe(2)
    expect(current.pointer).toBe(4)
    expect(current.flags).toEqual([1, 3])
    expect(current.red).toBe(2)
    expect(current.green).toBe(2)
    const statuses = roundStatuses(wordCount, current)
    expect(statuses[0]).toBe('green')
    expect(statuses[1]).toBe('red')
    expect(statuses[2]).toBe('green')
    expect(statuses[3]).toBe('red')
    expect(statuses[4]).toBe('gray')
  })

  it('the feed deck sees the carried flags after the round advances', async () => {
    const positions = await wordPositions()
    await setRoundFlag(BUCKET, 1, positions[1], true)
    await finishFeedRound()
    const round = (await getProgress(BUCKET)).round
    const words = await getWordsWithRoundFlag(BUCKET, round)
    expect(words.find((w) => w.position === positions[1])?.flagged).toBe(true)
    expect(words.find((w) => w.position === positions[0])?.flagged).toBe(false)
  })
})

describe('per-round flags', () => {
  it('keeps every round independent', async () => {
    const [p1, , p3] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await finishFeedRound() // the probe moves to round 2
    await setRoundFlag(BUCKET, 2, p1, true)
    await setRoundFlag(BUCKET, 2, p3, true)
    expect(await countRoundFlags(BUCKET, 1)).toBe(1)
    expect(await countRoundFlags(BUCKET, 2)).toBe(2)
    await setRoundFlag(BUCKET, 1, p1, false)
    expect(await countRoundFlags(BUCKET, 1)).toBe(0)
    expect(await countRoundFlags(BUCKET, 2)).toBe(2)
  })

  it('refuses to flag a future round', async () => {
    await expect(setRoundFlag(BUCKET, 2, 1, true)).rejects.toThrow(/beyond the probe/)
  })

  it('joins the flag state onto the word rows of one round', async () => {
    const [p1, p2] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p2, true)
    const words: WordWithFlag[] = await getWordsWithRoundFlag(BUCKET, 1)
    const expected = Array.from({ length: words.length }, (_, i) => i === 1)
    expect(words.map((w) => w.flagged)).toEqual(expected)
    const other: WordWithFlag[] = await getWordsWithRoundFlag(BUCKET, 2)
    expect(other.map((w) => w.flagged)).toEqual(Array(words.length).fill(false))
  })
})

describe('review session counting (the zeroing rule)', () => {
  it('a draft exists while the feed is unfinished and resumes in place', async () => {
    const [p1, p2] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p2, true)

    const first = await openReviewSession(BUCKET, 1)
    expect(first).toMatchObject({ counted: false, number: null, queue: [p1, p2] })
    await settleReview(first!.id, p1)

    // Re-entry resumes the same session: same row, cursor kept.
    const second = await openReviewSession(BUCKET, 1)
    expect(second!.id).toBe(first!.id)
    expect(second!.lastPosition).toBe(p1)
  })

  it('finishing the feed discards the draft and starts the real time 1', async () => {
    const [p1, p2] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p2, true)
    const draft = await openReviewSession(BUCKET, 1)
    await settleReview(draft!.id, p1)

    // The user walks the whole feed: round 1 completes.
    await finishFeedRound()

    const real = await openReviewSession(BUCKET, 1)
    expect(real!.id).not.toBe(draft!.id)
    expect(real).toMatchObject({ counted: true, number: 1, lastPosition: 0, queue: [p1, p2] })

    // The walk reaches the end: the session is archived with a finish time.
    await settleReview(real!.id, p2)
    await finishReview(real!.id)

    // The next walk-through is time 2.
    const again = await openReviewSession(BUCKET, 1)
    expect(again).toMatchObject({ counted: true, number: 2, lastPosition: 0 })

    const rounds = await getRoundSummaries(BUCKET)
    expect(rounds.find((r) => r.round === 1)).toMatchObject({ reviewTimes: 2 })
  })

  it('a finished draft leaves no trace', async () => {
    const [p1] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    const draft = await openReviewSession(BUCKET, 1)
    await settleReview(draft!.id, p1)
    await finishReview(draft!.id)

    const next = await openReviewSession(BUCKET, 1)
    expect(next!.id).not.toBe(draft!.id)
    expect(next).toMatchObject({ counted: false, number: null })
  })

  it('returns no session when the round has no flags', async () => {
    expect(await openReviewSession(BUCKET, 1)).toBeNull()
  })
})

describe('bucket deletion', () => {
  const file: SeedFile = {
    name: 'custom',
    words: [
      { position: 1, word: 'alpha', ipa: '', meaning: 'm1', forms: [] },
      { position: 2, word: 'beta', ipa: '', meaning: 'm2', forms: [] },
    ],
  }

  async function seedCustom(): Promise<void> {
    const db = await getDb()
    const { withTransaction } = require('./harness').dbIndex()
    await seedBucketsFrom(db, withTransaction, [file])
  }

  it('hides the bucket from lists but keeps every row and statistic', async () => {
    await seedCustom()
    // Progress plus a daily pointer (feed usage) exist before the delete.
    await settleCard('custom', 1)
    await deleteBucket('custom')

    const ids = (await listBuckets()).map((b) => b.id)
    expect(ids).not.toContain('custom')
    expect(ids).toContain(BUCKET)
    // Words, probe and the day's pointer rows all survive the tombstone.
    expect(await getWords('custom')).toHaveLength(2)
    expect(await getProgress('custom')).toMatchObject({ round: 1, pointer: 1 })
    expect((await listDailyPointers()).some((p) => p.bucketId === 'custom')).toBe(true)
  })

  it('a cold start does not resurrect a deleted bundled bucket', async () => {
    await deleteBucket(BUCKET)
    const { withTransaction } = require('./harness').dbIndex()
    await seedBuckets(await getDb(), withTransaction)
    expect((await listBuckets()).map((b) => b.id)).not.toContain(BUCKET)
    // The study history stays exactly where it was.
    expect(await getWords(BUCKET)).not.toHaveLength(0)
  })

  it('re-importing the same JSON restores the bucket as it was', async () => {
    await seedCustom()
    await settleCard('custom', 2)
    await deleteBucket('custom')

    await importBucketFile(file)
    expect((await listBuckets()).map((b) => b.id)).toContain('custom')
    expect(await getProgress('custom')).toMatchObject({ round: 1, pointer: 2 })
  })

  it('restore brings bundled buckets back with their history', async () => {
    await deleteBucket(BUCKET)
    expect(await tombstonedBuckets()).toEqual([BUCKET])

    await restoreBuckets(await tombstonedBuckets())
    expect(await tombstonedBuckets()).toEqual([])
    expect((await listBuckets()).map((b) => b.id)).toContain(BUCKET)
    expect(await getProgress(BUCKET)).toMatchObject({ round: 1, pointer: 0 })
  })
})

describe('day review reconstruction', () => {
  const file: SeedFile = {
    name: 'custom',
    words: [
      { position: 1, word: 'alpha', ipa: '', meaning: 'm1', forms: [] },
      { position: 2, word: 'beta', ipa: '', meaning: 'm2', forms: [] },
    ],
  }

  async function seedCustom(): Promise<void> {
    const db = await getDb()
    const { withTransaction } = require('./harness').dbIndex()
    await seedBucketsFrom(db, withTransaction, [file])
  }

  it('a day spanning two rounds replays every round without dedup', async () => {
    await seedCustom()
    // Round 1: walk word 1, complete the round (its end is recorded too).
    await settleCard('custom', 1)
    await completeRound('custom')
    // Round 2: walk both words.
    await settleCard('custom', 1)
    await settleCard('custom', 2)

    const day = await getWordsCompletedOn(todayLocalDate())
    // Round 1's stretch (words 1-2) + round 2's stretch (words 1-2) = 4
    // entries; alpha and beta each appear twice, once per round.
    expect(day.map((w) => `${w.round}:${w.position}`)).toEqual(['1:1', '1:2', '2:1', '2:2'])
    expect(day[0]).toMatchObject({ word: 'alpha', bucketId: 'custom', round: 1 })
    expect(day[2]).toMatchObject({ word: 'alpha', bucketId: 'custom', round: 2 })

    // The queue matches the stats number: the day's global gain is 4.
    const pointers = await listDailyPointers()
    expect(pointers).toHaveLength(1)
    expect(pointers[0]).toMatchObject({ bucketId: 'custom', globalPosition: 4 })
  })

  it('shows each round its own flag state', async () => {
    await seedCustom()
    await settleCard('custom', 1)
    await setRoundFlag('custom', 1, 1, true) // flagged during round 1
    await completeRound('custom') // ...and carried into round 2 (回显)
    await setRoundFlag('custom', 2, 1, false) // unflagged during round 2
    await settleCard('custom', 1)

    const day = await getWordsCompletedOn(todayLocalDate())
    expect(day.find((w) => w.round === 1 && w.position === 1)?.flagged).toBe(true)
    expect(day.find((w) => w.round === 2 && w.position === 1)?.flagged).toBe(false)
  })
})

describe('flag review reconstruction', () => {
  const file: SeedFile = {
    name: 'custom',
    words: [
      { position: 1, word: 'alpha', ipa: '', meaning: 'm1', forms: [] },
      { position: 2, word: 'beta', ipa: '', meaning: 'm2', forms: [] },
    ],
  }

  async function seedCustom(): Promise<void> {
    const db = await getDb()
    const { withTransaction } = require('./harness').dbIndex()
    await seedBucketsFrom(db, withTransaction, [file])
  }

  it('replays the day flags in flag order, one entry per flag', async () => {
    await seedCustom()
    await setRoundFlag('custom', 1, 2, true) // beta first
    await setRoundFlag('custom', 1, 1, true) // then alpha
    await finishFeedRound2()

    // Round 2 also inherits round 1's flags (回显), so both words carry a
    // round-2 flag too. The carry and the fresh flag can land in the same
    // millisecond, so only the flag order across clear timestamps holds:
    // the first entry is the day's first flag (1:2, beta), and every flag
    // is present exactly once per round.
    const day = await getWordsFlaggedOn(todayLocalDate())
    expect(day).toHaveLength(4)
    expect(day.every((w) => w.flagged)).toBe(true)
    expect(day[0]).toMatchObject({ word: 'beta', bucketId: 'custom', round: 1 })
    expect(
      day
        .filter((w) => w.position === 1)
        .map((w) => w.round)
        .sort(),
    ).toEqual([1, 2])
    expect(
      day
        .filter((w) => w.position === 2)
        .map((w) => w.round)
        .sort(),
    ).toEqual([1, 2])
  })

  it('ignores flags from other days and words unflagged since', async () => {
    await seedCustom()
    const db = await getDb()
    // A flag planted yesterday: setRoundFlag stamps now, so rewrite it.
    await setRoundFlag('custom', 1, 1, true)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await db.run(
      sql`UPDATE round_flag SET flagged_at = ${yesterday.getTime()} WHERE bucket_id = 'custom' AND position = 1`,
    )
    // Today's flag of word 2, then unflagged — the row is gone.
    await setRoundFlag('custom', 1, 2, true)
    await setRoundFlag('custom', 1, 2, false)

    const day = await getWordsFlaggedOn(todayLocalDate())
    expect(day).toEqual([])
    const yesterdayFlags = await getWordsFlaggedOn(
      `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`,
    )
    expect(yesterdayFlags.map((w) => w.position)).toEqual([1])
  })
})

/** Walks the custom bucket through round 1's end and into round 2. */
async function finishFeedRound2(): Promise<void> {
  await settleCard('custom', 1)
  await settleCard('custom', 2)
  await completeRound('custom')
  await setRoundFlag('custom', 2, 1, true) // alpha again, in round 2
}
