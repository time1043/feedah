import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';
// Mirrors src/db/schema.ts. Bundled word banks never live here — the cloud
// stores only user state. Naming prefixes tables with `cloud_` to keep the
// Convex dashboard unambiguous.

export default defineSchema({
  ...authTables,

  // Per-user mirror of the local `bucket_progress` table. progressUpdatedAt
  // stamps the row for last-write-wins on startedAt.
  cloudBucketProgress: defineTable({
    userId: v.id('users'),
    bucketId: v.string(),
    round: v.number(),
    pointer: v.number(),
    startedAt: v.number(),
    progressUpdatedAt: v.number(),
  })
    .index('by_user_bucket', ['userId', 'bucketId']),

  // Per-user mirror of `round_word`.
  cloudRoundWord: defineTable({
    userId: v.id('users'),
    bucketId: v.string(),
    round: v.number(),
    position: v.number(),
    reached: v.boolean(),
    flagged: v.boolean(),
    reachedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_bucket_round', ['userId', 'bucketId', 'round']),

  // Per-user mirror of `round_history`.
  cloudRoundHistory: defineTable({
    userId: v.id('users'),
    bucketId: v.string(),
    round: v.number(),
    startedAt: v.number(),
    finishedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_bucket_round', ['userId', 'bucketId', 'round']),

  // Per-user mirror of `daily_stat` (seconds per day).
  cloudDailyStat: defineTable({
    userId: v.id('users'),
    day: v.string(),
    feedSeconds: v.number(),
    appSeconds: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_day', ['userId', 'day']),

  // Per-user mirror of `daily_pointer` (high-water snapshots).
  cloudDailyPointer: defineTable({
    userId: v.id('users'),
    day: v.string(),
    bucketId: v.string(),
    globalPosition: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_day_bucket', ['userId', 'day', 'bucketId']),

  // Per-user mirror of `word.flagged` (the cross-round bookmark truth).
  cloudWordFlag: defineTable({
    userId: v.id('users'),
    bucketId: v.string(),
    position: v.number(),
    flagged: v.boolean(),
    flaggedAt: v.number(),
  })
    .index('by_user_bucket', ['userId', 'bucketId']),

  // Per-user mirror of `meta` (settings). value stays an opaque JSON string.
  cloudMeta: defineTable({
    userId: v.id('users'),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user_key', ['userId', 'key']),
});
