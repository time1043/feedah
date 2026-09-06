import { and, eq } from 'drizzle-orm';

import { getDb } from '@/db/index';
import {
  bucketProgress,
  dailyPointer,
  dailyStat,
  meta,
  roundHistory,
  roundWord,
  word,
} from '@/db/schema';

// Client-side half of the field-level merge: cloud rows flow into SQLite under
// the same rules the `sync.push` mutation applies on the server (see
// docs/cloud-sync.md). After a sync both sides converge to the same state.

export type CloudState = {
  progress: {
    bucketId: string;
    round: number;
    pointer: number;
    startedAt: number;
    progressUpdatedAt: number;
  }[];
  roundWords: {
    bucketId: string;
    round: number;
    position: number;
    reached: boolean;
    flagged: boolean;
    reachedAt: number;
    updatedAt: number;
  }[];
  roundHistory: {
    bucketId: string;
    round: number;
    startedAt: number;
    finishedAt: number;
    updatedAt: number;
  }[];
  dailyStats: {
    day: string;
    feedSeconds: number;
    appSeconds: number;
    updatedAt: number;
  }[];
  dailyPointers: {
    day: string;
    bucketId: string;
    globalPosition: number;
    updatedAt: number;
  }[];
  wordFlags: {
    bucketId: string;
    position: number;
    flagged: boolean;
    flaggedAt: number;
  }[];
  meta: { key: string; value: string; updatedAt: number }[];
};

export type ApplyResult = {
  /** Whether any local row changed (screens may need to re-read). */
  changed: boolean;
  /** True when the merged `meta` rows changed — settings must reload. */
  metaChanged: boolean;
};

export async function applyCloudState(cloud: CloudState): Promise<ApplyResult> {
  const db = await getDb();
  let changed = false;
  let metaChanged = false;

  for (const p of cloud.progress) {
    const local = await db
      .select()
      .from(bucketProgress)
      .where(eq(bucketProgress.bucketId, p.bucketId))
      .get();
    if (!local) {
      await db.insert(bucketProgress).values(p);
      changed = true;
      continue;
    }
    const round = Math.max(local.round, p.round);
    // The pointer rides the higher round; a stale device in an older round
    // must not drag it back.
    const pointer =
      p.round > local.round ? p.pointer
      : local.round > p.round ? local.pointer
      : Math.max(local.pointer, p.pointer);
    const startedAt = p.progressUpdatedAt > local.progressUpdatedAt ? p.startedAt : local.startedAt;
    if (round !== local.round || pointer !== local.pointer || startedAt !== local.startedAt) {
      await db
        .update(bucketProgress)
        .set({ round, pointer, startedAt })
        .where(eq(bucketProgress.bucketId, p.bucketId));
      changed = true;
    }
  }

  for (const rw of cloud.roundWords) {
    const keys = and(
      eq(roundWord.bucketId, rw.bucketId),
      eq(roundWord.round, rw.round),
      eq(roundWord.position, rw.position),
    );
    const local = await db.select().from(roundWord).where(keys).get();
    if (!local) {
      await db.insert(roundWord).values(rw);
      changed = true;
      continue;
    }
    const reached = local.reached || rw.reached;
    const flagged = local.flagged || rw.flagged;
    const reachedAt = Math.max(local.reachedAt, rw.reachedAt);
    const updatedAt = Math.max(local.updatedAt, rw.updatedAt);
    if (
      reached !== local.reached ||
      flagged !== local.flagged ||
      reachedAt !== local.reachedAt ||
      updatedAt !== local.updatedAt
    ) {
      await db.update(roundWord).set({ reached, flagged, reachedAt, updatedAt }).where(keys);
      changed = true;
    }
  }

  for (const rh of cloud.roundHistory) {
    const keys = and(eq(roundHistory.bucketId, rh.bucketId), eq(roundHistory.round, rh.round));
    const local = await db.select().from(roundHistory).where(keys).get();
    if (!local) {
      await db.insert(roundHistory).values(rh);
      changed = true;
      continue;
    }
    const startedAt = Math.min(local.startedAt, rh.startedAt);
    const finishedAt = Math.max(local.finishedAt, rh.finishedAt);
    const updatedAt = Math.max(local.updatedAt, rh.updatedAt);
    if (
      startedAt !== local.startedAt ||
      finishedAt !== local.finishedAt ||
      updatedAt !== local.updatedAt
    ) {
      await db.update(roundHistory).set({ startedAt, finishedAt, updatedAt }).where(keys);
      changed = true;
    }
  }

  for (const ds of cloud.dailyStats) {
    const local = await db.select().from(dailyStat).where(eq(dailyStat.day, ds.day)).get();
    if (!local) {
      await db.insert(dailyStat).values(ds);
      changed = true;
      continue;
    }
    const feedSeconds = Math.max(local.feedSeconds, ds.feedSeconds);
    const appSeconds = Math.max(local.appSeconds, ds.appSeconds);
    const updatedAt = Math.max(local.updatedAt, ds.updatedAt);
    if (
      feedSeconds !== local.feedSeconds ||
      appSeconds !== local.appSeconds ||
      updatedAt !== local.updatedAt
    ) {
      await db.update(dailyStat).set({ feedSeconds, appSeconds, updatedAt }).where(eq(dailyStat.day, ds.day));
      changed = true;
    }
  }

  for (const dp of cloud.dailyPointers) {
    const keys = and(eq(dailyPointer.day, dp.day), eq(dailyPointer.bucketId, dp.bucketId));
    const local = await db.select().from(dailyPointer).where(keys).get();
    if (!local) {
      await db.insert(dailyPointer).values(dp);
      changed = true;
      continue;
    }
    const globalPosition = Math.max(local.globalPosition, dp.globalPosition);
    const updatedAt = Math.max(local.updatedAt, dp.updatedAt);
    if (globalPosition !== local.globalPosition || updatedAt !== local.updatedAt) {
      await db.update(dailyPointer).set({ globalPosition, updatedAt }).where(keys);
      changed = true;
    }
  }

  for (const wf of cloud.wordFlags) {
    const keys = and(eq(word.bucketId, wf.bucketId), eq(word.position, wf.position));
    const local = await db.select().from(word).where(keys).get();
    if (!local) continue; // bundled rows always exist locally
    // LWW by flaggedAt so an unflag on one device propagates. Unflagging also
    // clears the current round's round_word row, mirroring local setFlag
    // semantics (finished rounds are append-only history and stay untouched).
    if (wf.flaggedAt > local.flaggedAt) {
      await db.update(word).set({ flagged: wf.flagged, flaggedAt: wf.flaggedAt }).where(keys);
      changed = true;
      if (!wf.flagged) {
        const progress = await db
          .select()
          .from(bucketProgress)
          .where(eq(bucketProgress.bucketId, wf.bucketId))
          .get();
        if (progress) {
          await db
            .update(roundWord)
            .set({ flagged: false })
            .where(
              and(
                eq(roundWord.bucketId, wf.bucketId),
                eq(roundWord.round, progress.round),
                eq(roundWord.position, wf.position),
              ),
            );
        }
      }
    }
  }

  for (const m of cloud.meta) {
    const local = await db.select().from(meta).where(eq(meta.key, m.key)).get();
    if (!local) {
      await db.insert(meta).values(m);
      changed = true;
      metaChanged = true;
      continue;
    }
    if (m.updatedAt > local.updatedAt && m.value !== local.value) {
      await db.update(meta).set({ value: m.value, updatedAt: m.updatedAt }).where(eq(meta.key, m.key));
      changed = true;
      metaChanged = true;
    } else if (m.updatedAt > local.updatedAt) {
      await db.update(meta).set({ updatedAt: m.updatedAt }).where(eq(meta.key, m.key));
    }
  }

  return { changed, metaChanged };
}
