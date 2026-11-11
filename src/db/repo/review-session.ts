import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import type { ReviewSessionRow } from '../schema/review-session'

import { getDb, withTransaction } from '../index'
import { reviewSession } from '../schema/review-session'
import { roundFlag } from '../schema/study-round'
import { isRoundComplete } from './study-round'

export type { ReviewSessionRow } from '../schema/review-session'

/**
 * Opens (or resumes) a review walk-through of one round's flag list.
 *   - An open session is resumed as-is: its queue snapshot and cursor stay
 *     frozen; flag edits since never rewrite an in-flight walk.
 *   - With the round's feed complete, a fresh entry discards all drafts
 *     (抹零) and starts the real `time {n+1}` from the current flag list.
 *   - Without it, a single draft is kept (resumable, never counted).
 * Returns null when the round has no flags at all — no session for that.
 *
 * The open-check and the create are two steps, not one lock: a single JS
 * thread does not race itself, and the partial unique index is the real
 * guard for drafts — the counted path assumes the same single reader.
 */
export async function openReviewSession(
  bucketName: string,
  round: number,
): Promise<ReviewSessionRow | null> {
  const db = await getDb()
  // The queue is the round's flag list at open time, ascending by position —
  // the same order the word list and the timeline speak in.
  const flagRows = await db
    .select({ position: roundFlag.position })
    .from(roundFlag)
    .where(and(eq(roundFlag.bucketName, bucketName), eq(roundFlag.round, round)))
    .orderBy(roundFlag.position)
  const queue = flagRows.map((row) => row.position)
  if (queue.length === 0) {
    // The round holds no flags now — but a walk opened while they existed
    // may still sit open. A draft can never become a real review against an
    // empty list, so it clears (leaving no trace, like any finished draft);
    // an open counted session is left alone — its walk happened, and the
    // screen finishes it when its joined queue reads empty.
    await db
      .delete(reviewSession)
      .where(
        and(
          eq(reviewSession.bucketName, bucketName),
          eq(reviewSession.round, round),
          eq(reviewSession.counted, false),
          isNull(reviewSession.finishedAt),
        ),
      )
    return null
  }

  const openRows = await db
    .select()
    .from(reviewSession)
    .where(
      and(
        eq(reviewSession.bucketName, bucketName),
        eq(reviewSession.round, round),
        isNull(reviewSession.finishedAt),
      ),
    )
    .limit(1)
  const open = openRows[0]
  const roundDone = await isRoundComplete(bucketName, round)
  // Resume an open session — except a draft whose feed has since completed:
  // its queue snapshot predates the finished round, so it can never become a
  // real review. It is discarded and the walk starts fresh below (抹零).
  if (open && (open.counted || !roundDone)) return open

  const now = Date.now()
  // The discard-or-number decision and its writes share one transaction: a
  // crash between them must not strand a draft-less round without its time.
  return withTransaction(async () => {
    if (roundDone) {
      // The real walk-through: drafts are zeroed and the number sticks.
      await db
        .delete(reviewSession)
        .where(
          and(
            eq(reviewSession.bucketName, bucketName),
            eq(reviewSession.round, round),
            eq(reviewSession.counted, false),
          ),
        )
      const counted = await db
        .select({ n: count() })
        .from(reviewSession)
        .where(
          and(
            eq(reviewSession.bucketName, bucketName),
            eq(reviewSession.round, round),
            eq(reviewSession.counted, true),
          ),
        )
      const rows = await db
        .insert(reviewSession)
        .values({
          bucketName,
          round,
          counted: true,
          number: (counted[0]?.n ?? 0) + 1,
          queue,
          lastPosition: 0,
          startedAt: now,
          updatedAt: now,
        })
        .returning()
      return rows[0]
    }
    // A draft. Finished drafts were deleted on completion; this clears any
    // straggler so the single-draft unique index holds.
    await db
      .delete(reviewSession)
      .where(
        and(
          eq(reviewSession.bucketName, bucketName),
          eq(reviewSession.round, round),
          eq(reviewSession.counted, false),
          isNotNull(reviewSession.finishedAt),
        ),
      )
    const rows = await db
      .insert(reviewSession)
      .values({
        bucketName,
        round,
        counted: false,
        number: null,
        queue,
        lastPosition: 0,
        startedAt: now,
        updatedAt: now,
      })
      .returning()
    return rows[0]
  })
}

/** Advances the session's resume watermark; monotonic, in word positions —
 * settling an earlier card than the walk has already passed changes nothing. */
export async function settleReview(sessionId: number, position: number): Promise<void> {
  const db = await getDb()
  await db
    .update(reviewSession)
    .set({
      lastPosition: sql`MAX(${reviewSession.lastPosition}, ${position})`,
      updatedAt: Date.now(),
    })
    .where(eq(reviewSession.id, sessionId))
}

/**
 * The walk reached its end card: a counted session is archived with its
 * finish time; a draft is deleted — unfinished-feed reviews leave no trace.
 */
export async function finishReview(sessionId: number): Promise<void> {
  const db = await getDb()
  const rows = await db.select().from(reviewSession).where(eq(reviewSession.id, sessionId)).limit(1)
  const session = rows[0]
  if (!session || session.finishedAt !== null) return
  if (session.counted) {
    await db
      .update(reviewSession)
      .set({ finishedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(reviewSession.id, sessionId))
    return
  }
  await db.delete(reviewSession).where(eq(reviewSession.id, sessionId))
}

/** How many real walk-throughs the round has had — a draft displays n + 1. */
export async function countedReviewCount(bucketName: string, round: number): Promise<number> {
  const db = await getDb()
  const rows = await db
    .select({ n: count() })
    .from(reviewSession)
    .where(
      and(
        eq(reviewSession.bucketName, bucketName),
        eq(reviewSession.round, round),
        eq(reviewSession.counted, true),
      ),
    )
  return rows[0]?.n ?? 0
}
