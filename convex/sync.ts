import { v } from 'convex/values';
import { GenericId } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, mutation, MutationCtx, query, QueryCtx } from './_generated/server';
import { auth } from './auth';

// Cloud-side half of the sync engine. The client pulls the user's full state,
// merges it into SQLite, then pushes its full state back; both sides apply the
// same per-field rules, so the two converge to the same merged state.
//
// round_word is compacted to ONE cloud doc per round (reached/flagged position
// arrays) so a 3,120-word round is a single row instead of 3,120, and the
// server merge is an O(reached) array union instead of an O(words^2) per-word
// lookup. Sync is still full-state (no incremental yet) — fine at current
// volumes, but incremental push/pull is the planned scaling step once a user
// accrues many rounds. See docs/cloud-sync.md "Decisions & trade-offs".
//
// Merge rules (see docs/cloud-sync.md):
//   bucket_progress  round/pointer ride the higher round, startedAt by LWW
//   round_word       one cloud doc per round; reached/flagged are position
//                    arrays merged by union across devices (history appends)
//   round_history    union, startedAt = min, finishedAt = max
//   daily_stat       per metric max (a high-water beat; summing would
//                    double-count the same day across devices)
//   daily_pointer    globalPosition = max (high-water snapshots)
//   word flag        last-write-wins by flaggedAt (unflagging propagates)
//   meta             last-write-wins by updatedAt

export const pull = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const [progress, roundWords, roundHistory, dailyStats, dailyPointers, wordFlags, meta] =
      await Promise.all([
        ctx.db.query('cloudBucketProgress').withIndex('by_user_bucket', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudRoundWord').withIndex('by_user_bucket_round', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudRoundHistory').withIndex('by_user_bucket_round', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudDailyStat').withIndex('by_user_day', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudDailyPointer').withIndex('by_user_day_bucket', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudWordFlag').withIndex('by_user_bucket', (q) => q.eq('userId', userId)).collect(),
        ctx.db.query('cloudMeta').withIndex('by_user_key', (q) => q.eq('userId', userId)).collect(),
      ]);
    return {
      progress: progress.map(({ userId: _userId, ...row }) => row),
      roundWords: roundWords.map(({ userId: _userId, ...row }) => row),
      roundHistory: roundHistory.map(({ userId: _userId, ...row }) => row),
      dailyStats: dailyStats.map(({ userId: _userId, ...row }) => row),
      dailyPointers: dailyPointers.map(({ userId: _userId, ...row }) => row),
      wordFlags: wordFlags.map(({ userId: _userId, ...row }) => row),
      meta: meta.map(({ userId: _userId, ...row }) => row),
      pulledAt: Date.now(),
    };
  },
});

export const push = mutation({
  args: {
    progress: v.array(
      v.object({
        bucketId: v.string(),
        round: v.number(),
        pointer: v.number(),
        startedAt: v.number(),
        progressUpdatedAt: v.number(),
      }),
    ),
    roundWords: v.array(
      v.object({
        bucketId: v.string(),
        round: v.number(),
        reached: v.array(v.number()),
        flagged: v.array(v.number()),
        updatedAt: v.number(),
      }),
    ),
    roundHistory: v.array(
      v.object({
        bucketId: v.string(),
        round: v.number(),
        startedAt: v.number(),
        finishedAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
    dailyStats: v.array(
      v.object({
        day: v.string(),
        feedSeconds: v.number(),
        appSeconds: v.number(),
        updatedAt: v.number(),
      }),
    ),
    dailyPointers: v.array(
      v.object({
        day: v.string(),
        bucketId: v.string(),
        globalPosition: v.number(),
        updatedAt: v.number(),
      }),
    ),
    wordFlags: v.array(
      v.object({
        bucketId: v.string(),
        position: v.number(),
        flagged: v.boolean(),
        flaggedAt: v.number(),
      }),
    ),
    meta: v.array(v.object({ key: v.string(), value: v.string(), updatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    for (const p of args.progress) {
      const existing = await findProgress(ctx, userId, p.bucketId);
      if (!existing) {
        await ctx.db.insert('cloudBucketProgress', { userId, ...p });
        continue;
      }
      // The pointer rides the higher round; a stale device in an older round
      // must not drag it back.
      const round = Math.max(existing.round, p.round);
      const pointer =
        p.round > existing.round ? p.pointer
        : existing.round > p.round ? existing.pointer
        : Math.max(existing.pointer, p.pointer);
      const startedAt =
        p.progressUpdatedAt > existing.progressUpdatedAt ? p.startedAt : existing.startedAt;
      await ctx.db.patch(existing._id, { round, pointer, startedAt });
    }

    for (const rw of args.roundWords) {
      const existing = await findRoundWordDoc(ctx, userId, rw.bucketId, rw.round);
      if (!existing) {
        await ctx.db.insert('cloudRoundWord', {
          userId,
          bucketId: rw.bucketId,
          round: rw.round,
          reached: rw.reached,
          flagged: rw.flagged,
          updatedAt: rw.updatedAt,
        });
        continue;
      }
      await ctx.db.patch(existing._id, {
        reached: unionPositions(existing.reached, rw.reached),
        flagged: unionPositions(existing.flagged, rw.flagged),
        updatedAt: Math.max(existing.updatedAt, rw.updatedAt),
      });
    }

    for (const rh of args.roundHistory) {
      const existing = await findRoundHistory(ctx, userId, rh.bucketId, rh.round);
      if (!existing) {
        await ctx.db.insert('cloudRoundHistory', { userId, ...rh });
        continue;
      }
      await ctx.db.patch(existing._id, {
        startedAt: Math.min(existing.startedAt, rh.startedAt),
        finishedAt: Math.max(existing.finishedAt, rh.finishedAt),
        updatedAt: Math.max(existing.updatedAt, rh.updatedAt),
      });
    }

    for (const ds of args.dailyStats) {
      const existing = await findDailyStat(ctx, userId, ds.day);
      if (!existing) {
        await ctx.db.insert('cloudDailyStat', { userId, ...ds });
        continue;
      }
      await ctx.db.patch(existing._id, {
        feedSeconds: Math.max(existing.feedSeconds, ds.feedSeconds),
        appSeconds: Math.max(existing.appSeconds, ds.appSeconds),
        updatedAt: Math.max(existing.updatedAt, ds.updatedAt),
      });
    }

    for (const dp of args.dailyPointers) {
      const existing = await findDailyPointer(ctx, userId, dp.day, dp.bucketId);
      if (!existing) {
        await ctx.db.insert('cloudDailyPointer', { userId, ...dp });
        continue;
      }
      await ctx.db.patch(existing._id, {
        globalPosition: Math.max(existing.globalPosition, dp.globalPosition),
        updatedAt: Math.max(existing.updatedAt, dp.updatedAt),
      });
    }

    for (const wf of args.wordFlags) {
      const existing = await findWordFlag(ctx, userId, wf.bucketId, wf.position);
      if (!existing) {
        await ctx.db.insert('cloudWordFlag', { userId, ...wf });
        continue;
      }
      // LWW by flaggedAt so an unflag on one device propagates.
      if (wf.flaggedAt > existing.flaggedAt) {
        await ctx.db.patch(existing._id, { flagged: wf.flagged, flaggedAt: wf.flaggedAt });
      }
    }

    for (const m of args.meta) {
      const existing = await findMeta(ctx, userId, m.key);
      if (!existing) {
        await ctx.db.insert('cloudMeta', { userId, ...m });
        continue;
      }
      if (m.updatedAt > existing.updatedAt) {
        await ctx.db.patch(existing._id, { value: m.value, updatedAt: m.updatedAt });
      }
    }

    return { pushedAt: Date.now() };
  },
});

/** Drops every cloud row of the signed-in user. Called by the app's
 * "clear all data" before the local reset so a later sync cannot resurrect
 * erased state; unauthenticated callers are a silent no-op. */
export const wipeMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await auth.getUserId(ctx);
    if (!user) return;
    await ctx.runMutation(internal.sync.wipe, { userId: user });
  },
});

/** Dev only: erases every auth and cloud row, resetting the deployment to a
 * clean slate (orphans included). Never call from app code — invoke it from
 * the CLI: `npx convex run sync:resetAll '{}'`. Devices keep their cached
 * sessions, so sign out and sign in again after a reset. */
export const resetAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of [
      'cloudBucketProgress',
      'cloudRoundWord',
      'cloudRoundHistory',
      'cloudDailyStat',
      'cloudDailyPointer',
      'cloudWordFlag',
      'cloudMeta',
      'authSessions',
      'authAccounts',
      'users',
    ] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/** Dev utility: drops every cloud row of one user (wired to wipeMyData). */
export const wipe = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    for (const table of [
      'cloudBucketProgress',
      'cloudRoundWord',
      'cloudRoundHistory',
      'cloudDailyStat',
      'cloudDailyPointer',
      'cloudWordFlag',
      'cloudMeta',
    ] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        if (row.userId === userId) await ctx.db.delete(row._id);
      }
    }
  },
});

async function requireUser(
  ctx: MutationCtx | QueryCtx,
): Promise<GenericId<'users'>> {
  const user = await auth.getUserId(ctx);
  if (!user) throw new Error('unauthenticated: sign in before syncing');
  return user;
}

async function findProgress(ctx: MutationCtx, userId: GenericId<'users'>, bucketId: string) {
  return ctx.db
    .query('cloudBucketProgress')
    .withIndex('by_user_bucket', (q) => q.eq('userId', userId).eq('bucketId', bucketId))
    .unique();
}

async function findRoundWordDoc(
  ctx: MutationCtx,
  userId: GenericId<'users'>,
  bucketId: string,
  round: number,
) {
  return ctx.db
    .query('cloudRoundWord')
    .withIndex('by_user_bucket_round', (q) =>
      q.eq('userId', userId).eq('bucketId', bucketId).eq('round', round),
    )
    .unique();
}

/** Returns the sorted union of two position arrays (used to merge reached /
 * flagged sets across devices). Empty inputs short-circuit to the other side. */
function unionPositions(a: number[], b: number[]): number[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const set = new Set(a);
  for (const n of b) set.add(n);
  return Array.from(set).sort((x, y) => x - y);
}

async function findRoundHistory(
  ctx: MutationCtx,
  userId: GenericId<'users'>,
  bucketId: string,
  round: number,
) {
  return ctx.db
    .query('cloudRoundHistory')
    .withIndex('by_user_bucket_round', (q) =>
      q.eq('userId', userId).eq('bucketId', bucketId).eq('round', round),
    )
    .unique();
}

async function findDailyStat(ctx: MutationCtx, userId: GenericId<'users'>, day: string) {
  return ctx.db
    .query('cloudDailyStat')
    .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
    .unique();
}

async function findDailyPointer(
  ctx: MutationCtx,
  userId: GenericId<'users'>,
  day: string,
  bucketId: string,
) {
  const rows = await ctx.db
    .query('cloudDailyPointer')
    .withIndex('by_user_day_bucket', (q) => q.eq('userId', userId).eq('day', day))
    .collect();
  return rows.find((r) => r.bucketId === bucketId) ?? null;
}

async function findWordFlag(
  ctx: MutationCtx,
  userId: GenericId<'users'>,
  bucketId: string,
  position: number,
) {
  const rows = await ctx.db
    .query('cloudWordFlag')
    .withIndex('by_user_bucket', (q) => q.eq('userId', userId).eq('bucketId', bucketId))
    .collect();
  return rows.find((r) => r.position === position) ?? null;
}

async function findMeta(ctx: MutationCtx, userId: GenericId<'users'>, key: string) {
  return ctx.db
    .query('cloudMeta')
    .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', key))
    .unique();
}
