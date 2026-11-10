//
// The repo's write rules, against the real migration DDL: the probe's
// forward-only cursor, the flag carry into the next round, and the review
// session's counting (the zeroing rule).
//

// Typed by the real module, resolved to the harness at runtime.
import { eq } from 'drizzle-orm'

import { getDb } from '@/db/index'
import { listDailyPointers } from '@/db/repo/daily'
import {
  countedReviewCount,
  finishReview,
  openReviewSession,
  settleReview,
} from '@/db/repo/review-session'
import {
  completeRound,
  countRoundFlags,
  getProgress,
  getRoundsByBucket,
  getWordsWithRoundFlag,
  setRoundFlag,
  settleCard,
} from '@/db/repo/study-round'
import { reviewSession } from '@/db/schema/review-session'
import { seedBuckets } from '@/db/seed'
import { todayLocalDate } from '@/lib/date'

import { resetDb, type dbClient, type dbIndex } from './harness'

jest.mock('@/db/client', () => {
  const harness = jest.requireActual<{ dbClient: typeof dbClient }>('./harness')
  return harness.dbClient()
})

jest.mock('@/db/index', () => {
  const harness = jest.requireActual<{ dbIndex: typeof dbIndex }>('./harness')
  return harness.dbIndex()
})

const BUCKET = '2050'

async function seed(): Promise<void> {
  const db = await getDb()
  await seedBuckets(db)
}

/** The bucket's word positions in deck order — flags and queues use these. */
async function wordPositions(): Promise<number[]> {
  const [, words] = await getWordsWithRoundFlag(BUCKET, 1)
  return words.map((word) => word.position)
}

/** Walks the probe through the whole round and completes it. */
async function finishFeedRound(): Promise<void> {
  const [, words] = await getWordsWithRoundFlag(BUCKET, 1)
  const wordCount = words.length
  for (let i = 1; i < wordCount; i++) await settleCard(BUCKET, i)
  await completeRound(BUCKET, Date.now())
}

beforeEach(async () => {
  resetDb()
  await seed()
})

describe('probe', () => {
  it('defaults to round 1 pointer 0 and only moves forward', async () => {
    expect(await getProgress(BUCKET)).toMatchObject({ round: 1, pointer: 0 })
    await settleCard(BUCKET, 2)
    await settleCard(BUCKET, 1)
    expect((await getProgress(BUCKET)).pointer).toBe(2)
  })

  it('advances the round in one transaction when the end card settles', async () => {
    const [, words] = await getWordsWithRoundFlag(BUCKET, 1)
    await finishFeedRound()
    expect(await getProgress(BUCKET)).toMatchObject({ round: 2, pointer: 0 })
    const [found, rows] = await getRoundsByBucket(BUCKET)
    expect(found).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.round === 1)).toMatchObject({
      done: true,
      swept: words.length,
    })
  })

  it("carries the finished round's flags into the next round", async () => {
    const [p1, p3] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p3, true)
    await finishFeedRound()
    expect(await countRoundFlags(BUCKET, 2)).toBe(2)
    expect(await countRoundFlags(BUCKET, 1)).toBe(2)
  })
})

describe('the daily pointer', () => {
  it('snapshots the end-of-day position on settle and on completion', async () => {
    const [, words] = await getWordsWithRoundFlag(BUCKET, 1)
    const wordCount = words.length
    // The ordinal is 1-based: settling the card at index 1 (the second card)
    // freezes global position 2.
    await settleCard(BUCKET, 1)
    const pointers = await listDailyPointers()
    expect(pointers).toHaveLength(1)
    expect(pointers[0]).toMatchObject({
      day: todayLocalDate(),
      bucketName: BUCKET,
      globalPosition: 2,
    })
    await finishFeedRound()
    const [endOfDay] = await listDailyPointers()
    // The completion itself is exposure: the end card lands on today's
    // watermark at the round's end.
    expect(endOfDay.globalPosition).toBe(wordCount)
  })

  it('keeps one row per bucket, moving forward only', async () => {
    await settleCard(BUCKET, 3)
    await settleCard(BUCKET, 1)
    const pointers = await listDailyPointers()
    expect(pointers).toHaveLength(1)
    expect(pointers[0].globalPosition).toBe(4)
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

    // The round list reads the draft, not a count.
    const [, rows] = await getRoundsByBucket(BUCKET)
    expect(rows.find((row) => row.round === 1)).toMatchObject({ reviewTimes: 0, hasDraft: true })
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
    expect(await countedReviewCount(BUCKET, 1)).toBe(2)

    // The round list counts the real walk-throughs, no draft pending.
    const [, rows] = await getRoundsByBucket(BUCKET)
    expect(rows.find((row) => row.round === 1)).toMatchObject({ reviewTimes: 2, hasDraft: false })
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

  it('the resume watermark only moves forward', async () => {
    const [p1, p2] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p2, true)
    const session = await openReviewSession(BUCKET, 1)
    await settleReview(session!.id, p2)
    await settleReview(session!.id, p1)
    const reread = await openReviewSession(BUCKET, 1)
    expect(reread!.lastPosition).toBe(p2)
  })

  it('flag edits never rewrite an in-flight walk', async () => {
    const [p1, p2, p3] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await setRoundFlag(BUCKET, 1, p2, true)
    const session = await openReviewSession(BUCKET, 1)

    // Marks added and cleared after the open leave the snapshot alone.
    await setRoundFlag(BUCKET, 1, p3, true)
    await setRoundFlag(BUCKET, 1, p1, false)

    const reread = await openReviewSession(BUCKET, 1)
    expect(reread!.id).toBe(session!.id)
    expect(reread!.queue).toEqual([p1, p2])
  })

  it('a round keeps at most one open draft (the partial unique index)', async () => {
    const [p1] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await openReviewSession(BUCKET, 1)

    const db = await getDb()
    await expect(
      db.insert(reviewSession).values({
        bucketName: BUCKET,
        round: 1,
        counted: false,
        number: null,
        queue: [p1],
        lastPosition: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ).rejects.toThrow()
  })

  it('a round whose flags all cleared deletes its open draft', async () => {
    const [p1] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await openReviewSession(BUCKET, 1)
    await setRoundFlag(BUCKET, 1, p1, false)

    expect(await openReviewSession(BUCKET, 1)).toBeNull()
    const db = await getDb()
    expect(await db.select().from(reviewSession)).toHaveLength(0)
  })

  it('a counted session resumes in place while its walk is unfinished', async () => {
    const [p1] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await finishFeedRound()

    const first = await openReviewSession(BUCKET, 1)
    expect(first).toMatchObject({ counted: true, number: 1 })
    await settleReview(first!.id, p1)

    const second = await openReviewSession(BUCKET, 1)
    expect(second!.id).toBe(first!.id)
    expect(second!.lastPosition).toBe(p1)
  })

  it('finishing an archived session changes nothing', async () => {
    const [p1] = await wordPositions()
    await setRoundFlag(BUCKET, 1, p1, true)
    await finishFeedRound()
    const session = await openReviewSession(BUCKET, 1)
    await finishReview(session!.id)

    const db = await getDb()
    const [archived] = await db
      .select()
      .from(reviewSession)
      .where(eq(reviewSession.id, session!.id))
    expect(archived.finishedAt).not.toBeNull()
    await finishReview(session!.id)
    const [reread] = await db.select().from(reviewSession).where(eq(reviewSession.id, session!.id))
    expect(reread.finishedAt).toBe(archived.finishedAt)
  })
})
