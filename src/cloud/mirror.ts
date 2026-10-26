import { and, eq, inArray, or, sql } from 'drizzle-orm';

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
    reached: number[];
    flagged: number[];
    wrong: number[];
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

// SQLite binds one host parameter per column, so a batched insert must stay
// under the per-statement parameter limit; 100 rows x 7 columns = 700
// parameters is safe on every build.
const INSERT_CHUNK = 100;

function chunkRows<T>(rows: T[]): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) parts.push(rows.slice(i, i + INSERT_CHUNK));
  return parts;
}

// Groups the cloud docs' second key by bucket so a bulk read is an OR of
// per-bucket pairs instead of a bucket x round/day cross product — a
// multi-bucket user would otherwise read every (bucket, key) combination.
function groupByBucket<T extends { bucketId: string }, K>(
  docs: T[],
  key: (doc: T) => K,
): [string, K[]][] {
  const byBucket = new Map<string, Set<K>>();
  for (const doc of docs) {
    let keys = byBucket.get(doc.bucketId);
    if (!keys) {
      keys = new Set();
      byBucket.set(doc.bucketId, keys);
    }
    keys.add(key(doc));
  }
  return [...byBucket].map(([bucketId, keys]) => [bucketId, [...keys]]);
}

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
      p.round > local.round
        ? p.pointer
        : local.round > p.round
          ? local.pointer
          : Math.max(local.pointer, p.pointer);
    const startedAt =
      p.round > local.round
        ? p.startedAt
        : local.round > p.round
          ? local.startedAt
          : local.startedAt === 0 && p.startedAt > 0
            ? p.startedAt
            : p.progressUpdatedAt > local.progressUpdatedAt
              ? p.startedAt
              : local.startedAt;
    const progressUpdatedAt = Math.max(local.progressUpdatedAt, p.progressUpdatedAt);
    if (
      round !== local.round ||
      pointer !== local.pointer ||
      startedAt !== local.startedAt ||
      progressUpdatedAt !== local.progressUpdatedAt
    ) {
      await db
        .update(bucketProgress)
        .set({ round, pointer, startedAt, progressUpdatedAt })
        .where(eq(bucketProgress.bucketId, p.bucketId));
      changed = true;
    }
  }

  // Cloud stores one compact doc per round (reached/flagged position arrays);
  // expand it back into the local per-word `round_word` rows, union-merging so
  // positions studied only on this device survive. Positions in the cloud arrays
  // that this device hasn't studied yet get created here, which is how a fresh
  // device rebuilds its historical heatmaps.
  //
  // A round spans up to thousands of `round_word` rows, so the row-at-a-time
  // select+write merge used for the small tables below would cross the
  // JS<->native bridge thousands of times per sync — on the same JS thread
  // touch events are dispatched on. Read every relevant row once, merge in
  // memory, and write back in batched statements.
  if (cloud.roundWords.length > 0) {
    const existingRows = await db
      .select()
      .from(roundWord)
      .where(
        or(
          ...groupByBucket(cloud.roundWords, (rw) => rw.round).map(([bucketId, rounds]) =>
            and(eq(roundWord.bucketId, bucketId), inArray(roundWord.round, rounds)),
          ),
        ),
      );
    const existing = new Map(
      existingRows.map((row) => [`${row.bucketId}|${row.round}|${row.position}`, row]),
    );
    const inserts: (typeof roundWord.$inferInsert)[] = [];
    const updates: {
      bucketId: string;
      round: number;
      position: number;
      reached: boolean;
      flagged: boolean;
      wrong: boolean;
      updatedAt: number;
    }[] = [];
    for (const rw of cloud.roundWords) {
      const reachedSet = new Set(rw.reached);
      const flaggedSet = new Set(rw.flagged);
      // Docs written before the wrong bit existed lack the field.
      const wrongSet = new Set(rw.wrong ?? []);
      const positions = new Set<number>([...rw.reached, ...rw.flagged, ...(rw.wrong ?? [])]);
      for (const pos of positions) {
        const reached = reachedSet.has(pos);
        const flagged = flaggedSet.has(pos);
        const wrong = wrongSet.has(pos);
        const local = existing.get(`${rw.bucketId}|${rw.round}|${pos}`);
        if (!local) {
          inserts.push({
            bucketId: rw.bucketId,
            round: rw.round,
            position: pos,
            reached,
            flagged,
            wrong,
            reachedAt: rw.updatedAt,
            updatedAt: rw.updatedAt,
          });
          changed = true;
          continue;
        }
        const newReached = local.reached || reached;
        const newFlagged = local.flagged || flagged;
        const newWrong = local.wrong || wrong;
        if (
          newReached !== local.reached ||
          newFlagged !== local.flagged ||
          newWrong !== local.wrong
        ) {
          updates.push({
            bucketId: rw.bucketId,
            round: rw.round,
            position: pos,
            reached: newReached,
            flagged: newFlagged,
            wrong: newWrong,
            updatedAt: rw.updatedAt,
          });
          changed = true;
        }
      }
    }
    // A local write can land between the bulk read and these inserts — the
    // deferral schedules syncs into exactly the window where the user resumes
    // studying. Union-merge on conflict instead of skipping, so a cloud
    // reached/flagged/wrong bit cannot be dropped by the race; the row keeps
    // its local timestamps, so the merged state still rides the next push.
    for (const part of chunkRows(inserts)) {
      await db
        .insert(roundWord)
        .values(part)
        .onConflictDoUpdate({
          target: [roundWord.bucketId, roundWord.round, roundWord.position],
          set: {
            reached: sql`max(excluded."reached", ${roundWord.reached})`,
            flagged: sql`max(excluded."flagged", ${roundWord.flagged})`,
            wrong: sql`max(excluded."wrong", ${roundWord.wrong})`,
          },
        });
    }
    for (const u of updates) {
      await db
        .update(roundWord)
        .set({
          reached: u.reached,
          flagged: u.flagged,
          wrong: u.wrong,
          updatedAt: u.updatedAt,
        })
        .where(
          and(
            eq(roundWord.bucketId, u.bucketId),
            eq(roundWord.round, u.round),
            eq(roundWord.position, u.position),
          ),
        );
    }
  }

  if (cloud.roundHistory.length > 0) {
    const existingRows = await db
      .select()
      .from(roundHistory)
      .where(
        or(
          ...groupByBucket(cloud.roundHistory, (rh) => rh.round).map(([bucketId, rounds]) =>
            and(eq(roundHistory.bucketId, bucketId), inArray(roundHistory.round, rounds)),
          ),
        ),
      );
    const existing = new Map(existingRows.map((row) => [`${row.bucketId}|${row.round}`, row]));
    const inserts: (typeof roundHistory.$inferInsert)[] = [];
    const updates: {
      bucketId: string;
      round: number;
      startedAt: number;
      finishedAt: number;
      updatedAt: number;
    }[] = [];
    for (const rh of cloud.roundHistory) {
      const local = existing.get(`${rh.bucketId}|${rh.round}`);
      if (!local) {
        inserts.push(rh);
        changed = true;
        continue;
      }
      const startedAt =
        local.startedAt === 0
          ? rh.startedAt
          : rh.startedAt === 0
            ? local.startedAt
            : Math.min(local.startedAt, rh.startedAt);
      const finishedAt = Math.max(local.finishedAt, rh.finishedAt);
      const updatedAt = Math.max(local.updatedAt, rh.updatedAt);
      if (
        startedAt !== local.startedAt ||
        finishedAt !== local.finishedAt ||
        updatedAt !== local.updatedAt
      ) {
        updates.push({ ...rh, startedAt, finishedAt, updatedAt });
        changed = true;
      }
    }
    // Same race as the round_word inserts; apply the same merge rules in SQL
    // (0-startedAt recovery, min/max high-water marks) so a concurrent local
    // startNextRound insert converges instead of being skipped.
    for (const part of chunkRows(inserts)) {
      await db
        .insert(roundHistory)
        .values(part)
        .onConflictDoUpdate({
          target: [roundHistory.bucketId, roundHistory.round],
          set: {
            startedAt: sql`case when ${roundHistory.startedAt} = 0 then excluded."started_at" when excluded."started_at" = 0 then ${roundHistory.startedAt} else min(${roundHistory.startedAt}, excluded."started_at") end`,
            finishedAt: sql`max(${roundHistory.finishedAt}, excluded."finished_at")`,
            updatedAt: sql`max(${roundHistory.updatedAt}, excluded."updated_at")`,
          },
        });
    }
    for (const u of updates) {
      await db
        .update(roundHistory)
        .set({
          startedAt: sql`case when ${roundHistory.startedAt} = 0 then ${u.startedAt} when ${u.startedAt} = 0 then ${roundHistory.startedAt} else min(${roundHistory.startedAt}, ${u.startedAt}) end`,
          finishedAt: sql`max(${roundHistory.finishedAt}, ${u.finishedAt})`,
          updatedAt: sql`max(${roundHistory.updatedAt}, ${u.updatedAt})`,
        })
        .where(and(eq(roundHistory.bucketId, u.bucketId), eq(roundHistory.round, u.round)));
    }
  }

  if (cloud.dailyStats.length > 0) {
    const existingRows = await db
      .select()
      .from(dailyStat)
      .where(
        inArray(
          dailyStat.day,
          cloud.dailyStats.map((ds) => ds.day),
        ),
      );
    const existing = new Map(existingRows.map((row) => [row.day, row]));
    const inserts: (typeof dailyStat.$inferInsert)[] = [];
    const updates: {
      day: string;
      feedSeconds: number;
      appSeconds: number;
      updatedAt: number;
    }[] = [];
    for (const ds of cloud.dailyStats) {
      const local = existing.get(ds.day);
      if (!local) {
        inserts.push(ds);
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
        updates.push({ day: ds.day, feedSeconds, appSeconds, updatedAt });
        changed = true;
      }
    }
    // Same race as the round_word inserts, but the concurrent local writer
    // here is the usage flush (it sums seconds every 10s), so merge with
    // SQL-side max instead of overwriting absolute values.
    for (const part of chunkRows(inserts)) {
      await db
        .insert(dailyStat)
        .values(part)
        .onConflictDoUpdate({
          target: dailyStat.day,
          set: {
            feedSeconds: sql`max(excluded."feed_seconds", ${dailyStat.feedSeconds})`,
            appSeconds: sql`max(excluded."app_seconds", ${dailyStat.appSeconds})`,
            updatedAt: sql`max(excluded."updated_at", ${dailyStat.updatedAt})`,
          },
        });
    }
    for (const u of updates) {
      await db
        .update(dailyStat)
        .set({
          feedSeconds: sql`max(${dailyStat.feedSeconds}, ${u.feedSeconds})`,
          appSeconds: sql`max(${dailyStat.appSeconds}, ${u.appSeconds})`,
          updatedAt: sql`max(${dailyStat.updatedAt}, ${u.updatedAt})`,
        })
        .where(eq(dailyStat.day, u.day));
    }
  }

  if (cloud.dailyPointers.length > 0) {
    const existingRows = await db
      .select()
      .from(dailyPointer)
      .where(
        or(
          ...groupByBucket(cloud.dailyPointers, (dp) => dp.day).map(([bucketId, days]) =>
            and(eq(dailyPointer.bucketId, bucketId), inArray(dailyPointer.day, days)),
          ),
        ),
      );
    const existing = new Map(existingRows.map((row) => [`${row.day}|${row.bucketId}`, row]));
    const inserts: (typeof dailyPointer.$inferInsert)[] = [];
    const updates: {
      day: string;
      bucketId: string;
      globalPosition: number;
      updatedAt: number;
    }[] = [];
    for (const dp of cloud.dailyPointers) {
      const local = existing.get(`${dp.day}|${dp.bucketId}`);
      if (!local) {
        inserts.push(dp);
        changed = true;
        continue;
      }
      const globalPosition = Math.max(local.globalPosition, dp.globalPosition);
      const updatedAt = Math.max(local.updatedAt, dp.updatedAt);
      if (globalPosition !== local.globalPosition || updatedAt !== local.updatedAt) {
        updates.push({ day: dp.day, bucketId: dp.bucketId, globalPosition, updatedAt });
        changed = true;
      }
    }
    // Same race as daily_stat: a settle advancing the pointer concurrently
    // must not be dragged back, so merge with SQL-side max.
    for (const part of chunkRows(inserts)) {
      await db
        .insert(dailyPointer)
        .values(part)
        .onConflictDoUpdate({
          target: [dailyPointer.day, dailyPointer.bucketId],
          set: {
            globalPosition: sql`max(excluded."global_position", ${dailyPointer.globalPosition})`,
            updatedAt: sql`max(excluded."updated_at", ${dailyPointer.updatedAt})`,
          },
        });
    }
    for (const u of updates) {
      await db
        .update(dailyPointer)
        .set({
          globalPosition: sql`max(${dailyPointer.globalPosition}, ${u.globalPosition})`,
          updatedAt: sql`max(${dailyPointer.updatedAt}, ${u.updatedAt})`,
        })
        .where(and(eq(dailyPointer.day, u.day), eq(dailyPointer.bucketId, u.bucketId)));
    }
  }

  // Word flags are few; merge them row-at-a-time, but read the existing rows
  // per bucket in one query instead of one query per flag.
  if (cloud.wordFlags.length > 0) {
    const bucketIds = [...new Set(cloud.wordFlags.map((wf) => wf.bucketId))];
    const progressRows = await db
      .select()
      .from(bucketProgress)
      .where(inArray(bucketProgress.bucketId, bucketIds));
    const progressByBucket = new Map(progressRows.map((row) => [row.bucketId, row]));
    for (const b of bucketIds) {
      const flags = cloud.wordFlags.filter((wf) => wf.bucketId === b);
      const wordRows = await db
        .select()
        .from(word)
        .where(
          and(
            eq(word.bucketId, b),
            inArray(
              word.position,
              flags.map((wf) => wf.position),
            ),
          ),
        );
      const byPosition = new Map(wordRows.map((row) => [row.position, row]));
      const unflagPositions: number[] = [];
      for (const wf of flags) {
        const local = byPosition.get(wf.position);
        if (!local) continue; // bundled rows always exist locally
        // LWW by flaggedAt so an unflag on one device propagates. Unflagging also
        // clears the current round's round_word row, mirroring local setFlag
        // semantics (finished rounds are append-only history and stay untouched).
        if (wf.flaggedAt > local.flaggedAt) {
          await db
            .update(word)
            .set({ flagged: wf.flagged, flaggedAt: wf.flaggedAt })
            .where(and(eq(word.bucketId, b), eq(word.position, wf.position)));
          changed = true;
          if (!wf.flagged) unflagPositions.push(wf.position);
        }
      }
      if (unflagPositions.length > 0) {
        const progress = progressByBucket.get(b);
        if (progress) {
          await db
            .update(roundWord)
            .set({ flagged: false })
            .where(
              and(
                eq(roundWord.bucketId, b),
                eq(roundWord.round, progress.round),
                inArray(roundWord.position, unflagPositions),
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
      await db
        .update(meta)
        .set({ value: m.value, updatedAt: m.updatedAt })
        .where(eq(meta.key, m.key));
      changed = true;
      metaChanged = true;
    } else if (m.updatedAt > local.updatedAt) {
      await db.update(meta).set({ updatedAt: m.updatedAt }).where(eq(meta.key, m.key));
    }
  }

  return { changed, metaChanged };
}
