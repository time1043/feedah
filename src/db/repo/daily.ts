import { sql } from 'drizzle-orm'

import type { Db } from '../index'

import { getDb } from '../index'
import { dailyPointer, dailyStat } from '../schema/daily'

/**
 * The daily tables' reads and writes. The pointer rows are written inside
 * the settle/complete transactions (the snapshot must never miss a moved
 * probe); the time rows are incremented by the usage meter's flushes.
 */

/** End-of-day high-water snapshot for one bucket; called inside the
 * settle/complete transaction, so a moved probe always carries its mark. */
export function upsertDailyPointer(
  db: Db,
  day: string,
  bucketName: string,
  globalPosition: number,
): Promise<unknown> {
  return db
    .insert(dailyPointer)
    .values({ day, bucketName, globalPosition, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: [dailyPointer.day, dailyPointer.bucketName],
      set: { globalPosition, updatedAt: Date.now() },
    })
}

/** Adds one flush of seconds to the day's time ledger (increment upsert). */
export async function addDailyTime(
  day: string,
  feedSeconds: number,
  appSeconds: number,
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db
    .insert(dailyStat)
    .values({ day, feedSeconds, appSeconds, updatedAt: now })
    .onConflictDoUpdate({
      target: dailyStat.day,
      set: {
        feedSeconds: sql`${dailyStat.feedSeconds} + excluded.feed_seconds`,
        appSeconds: sql`${dailyStat.appSeconds} + excluded.app_seconds`,
        updatedAt: now,
      },
    })
}

/** Every day's time ledger, ascending by day. */
export async function listDailyStats() {
  const db = await getDb()
  return db.select().from(dailyStat).orderBy(dailyStat.day)
}

/** Every recorded pointer snapshot, ascending by day. */
export async function listDailyPointers() {
  const db = await getDb()
  return db.select().from(dailyPointer).orderBy(dailyPointer.day)
}
