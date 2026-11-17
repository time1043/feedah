import AsyncStorage from '@react-native-async-storage/async-storage'
import { sql } from 'drizzle-orm'

import type { Db } from './index'

import { bucket } from './schema/bucket-word'
import { dailyPointer } from './schema/daily'

/**
 * One-time data repairs that must follow a semantics change in how rows are
 * written. Each repair runs at most once per install (an AsyncStorage flag),
 * because the rows it rewrites become indistinguishable from correctly
 * written ones afterwards.
 */

/** Marks that the settled-count pointer repair has run (or been skipped). */
const POINTER_SETTLED_REPAIR_KEY = 'feedah.repair.daily-pointer-settled'

/**
 * Rewrites the daily pointer rows left by the pre-settled-count snapshot,
 * which stored the 1-based ordinal of the parked card (settled + 1) on every
 * mid-round settle — inflating the first credited day by one (home said 7,
 * stats said 8). Completion rows were always exact (a multiple of the
 * bucket's word count) and stay untouched, so every non-multiple row loses
 * exactly its phantom card. Runs before any new-semantics write can exist:
 * it fires at DB open, before a screen can settle.
 *
 * The flag is written BEFORE the rows: a crash in between leaves the stale
 * rows alone (they self-correct on the bucket's next settle), while a repair
 * that ran twice would subtract twice and corrupt the history.
 */
export async function repairLegacyDailyPointers(db: Db): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(POINTER_SETTLED_REPAIR_KEY)) != null) return
    // An unguardable run (flag write failed) must not touch the rows: the
    // next open would run it again on top of this one.
    await AsyncStorage.setItem(POINTER_SETTLED_REPAIR_KEY, '1')
  } catch (error) {
    console.error('[db] pointer repair guard failed', error)
    return
  }

  try {
    const buckets = await db.select({ name: bucket.name, wordCount: bucket.wordCount }).from(bucket)
    for (const { name, wordCount } of buckets) {
      if (wordCount <= 0) continue
      await db
        .update(dailyPointer)
        .set({ globalPosition: sql`${dailyPointer.globalPosition} - 1` })
        .where(
          sql`${dailyPointer.bucketName} = ${name} AND ${dailyPointer.globalPosition} % ${wordCount} != 0`,
        )
    }
  } catch (error) {
    console.error('[db] daily pointer repair failed', error)
  }
}
