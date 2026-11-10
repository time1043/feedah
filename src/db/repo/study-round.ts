import { eq } from 'drizzle-orm'

import { getDb, withTransaction } from '../index'
import { bucketProgress, roundRecord } from '../schema/study-round'

/**
 * The study probe, as the session carries it: the round being studied and
 * the card index (0-based, the same number the reducer holds) the walk is
 * parked on — a reload resumes exactly there. roundStartedAt is a wall-clock
 * stamp of when that round began (0 for a probe that predates one).
 */
export type ProgressRow = {
  round: number
  pointer: number
  roundStartedAt: number
}

/** The study probe of one bucket; a missing row means the bucket was never
 * studied and reads the factory probe (round 1, card 0). */
export async function getProgress(bucketName: string): Promise<ProgressRow> {
  const db = await getDb()
  const rows = await db
    .select({
      round: bucketProgress.round,
      pointer: bucketProgress.pointer,
      roundStartedAt: bucketProgress.roundStartedAt,
    })
    .from(bucketProgress)
    .where(eq(bucketProgress.bucketName, bucketName))
    .limit(1)
  // A fresh object every time: the caller owns the probe it reads.
  return rows[0] ?? { round: 1, pointer: 0, roundStartedAt: 0 }
}

/**
 * The settle write: the pointer only ever moves forward (card N is behind
 * you once you have reached card N+1). Creates the probe row — round 1, the
 * round it stamps — on the first settle of a fresh bucket.
 */
export async function settleCard(bucketName: string, pointer: number): Promise<void> {
  const db = await getDb()
  await withTransaction(async () => {
    const rows = await db
      .select({ pointer: bucketProgress.pointer })
      .from(bucketProgress)
      .where(eq(bucketProgress.bucketName, bucketName))
      .limit(1)
    if (rows.length === 0) {
      await db
        .insert(bucketProgress)
        .values({ bucketName, round: 1, pointer, roundStartedAt: Date.now() })
        .onConflictDoNothing()
      return
    }
    if (pointer > rows[0].pointer) {
      await db
        .update(bucketProgress)
        .set({ pointer })
        .where(eq(bucketProgress.bucketName, bucketName))
    }
  })
}

/**
 * Completes the round: the finished round is recorded (its start and this
 * end stamp) and the probe steps to the next round at the first card. Both
 * writes share one transaction — a round never advances without its record.
 * Flags deliberately do not ride along here; they are another table.
 */
export async function completeRound(bucketName: string, now: number): Promise<void> {
  const db = await getDb()
  await withTransaction(async () => {
    const rows = await db
      .select({ round: bucketProgress.round, roundStartedAt: bucketProgress.roundStartedAt })
      .from(bucketProgress)
      .where(eq(bucketProgress.bucketName, bucketName))
      .limit(1)
    // A completed round implies the probe exists (reaching the end needed
    // settles), but a missing row still reads as round 1 with no start.
    const finished = rows[0] ?? { round: 1, roundStartedAt: 0 }
    const next = finished.round + 1

    // One row per round, first write wins: a duplicate completion must not
    // move the recorded span.
    await db
      .insert(roundRecord)
      .values({
        bucketName,
        round: finished.round,
        startedAt: finished.roundStartedAt,
        endedAt: now,
      })
      .onConflictDoNothing()

    if (rows.length === 0) {
      await db
        .insert(bucketProgress)
        .values({ bucketName, round: next, pointer: 0, roundStartedAt: now })
        .onConflictDoNothing()
      return
    }
    await db
      .update(bucketProgress)
      .set({ round: next, pointer: 0, roundStartedAt: now })
      .where(eq(bucketProgress.bucketName, bucketName))
  })
}
