import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const bucket = sqliteTable('bucket', {
  id: text('id').primaryKey(),
  wordCount: integer('word_count').notNull(),
})

export const word = sqliteTable(
  'word',
  {
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    ipa: text('ipa').notNull().default(''),
    meaning: text('meaning').notNull().default(''),
    // JSON-encoded string[]; mode:'json' (de)serializes transparently.
    forms: text('forms', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (t) => [primaryKey({ columns: [t.bucketId, t.position] })],
)

/**
 * The probe: the bucket's current feed round and how far it has walked.
 * Feed flows forward — earlier rounds have no probe anymore, they live in
 * round_history. `round_started_at` is the current round's start time.
 */
export const bucketProgress = sqliteTable('bucket_progress', {
  bucketId: text('bucket_id')
    .primaryKey()
    .references(() => bucket.id, { onDelete: 'cascade' }),
  round: integer('round').notNull().default(1),
  pointer: integer('pointer').notNull().default(0),
  roundStartedAt: integer('round_started_at').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
})

/**
 * Per-round flag lists, sparse: one row per flagged word, deleted on
 * unflag. Every round keeps its own list — the same word may be flagged in
 * round 1 and round 2 independently. Write-path rule: the round is always
 * passed in explicitly by the caller (feed → probe round, review/browse →
 * their pinned round); the repo never derives it.
 */
export const roundFlag = sqliteTable(
  'round_flag',
  {
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    position: integer('position').notNull(),
    flaggedAt: integer('flagged_at').notNull().default(0),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucketId, t.round, t.position] })],
)

/** Finished feed rounds: the round list's start time and duration. */
export const roundHistory = sqliteTable(
  'round_history',
  {
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucketId, t.round] })],
)

/**
 * Review walk-throughs of one round's flag list. Lifecycle (see
 * docs/data-model.md):
 *   - The queue is the round's full flag list, snapshotted (frozen) at
 *     creation; later flag edits never rewrite a session's walk.
 *   - `counted` is decided at creation: the round's feed must be complete
 *     (a round_history row exists). Drafts (uncounted, feed unfinished) are
 *     never promoted — once the feed completes, the next review discards
 *     them and starts a fresh, real `time N`.
 *   - At most one draft per (bucket, round) — partial unique index below.
 *     A finished draft is deleted, not archived.
 *   - `number` is the stored time number (null on drafts); the footer shows
 *     drafts as `time {counted count + 1} · uncounted`.
 *   - `last_position` is a word-position watermark (monotonic) — resume
 *     lands on the first queue word at or after it.
 * Drafts are local scratch and are never synced.
 */
export const reviewSession = sqliteTable(
  'review_session',
  {
    id: text('id').primaryKey(),
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    counted: integer('counted', { mode: 'boolean' }).notNull().default(false),
    number: integer('number'),
    // JSON-encoded number[]: the frozen flag positions, ascending.
    queue: text('queue', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),
    lastPosition: integer('last_position').notNull().default(0),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [
    index('idx_review_session_round').on(t.bucketId, t.round),
    uniqueIndex('review_session_draft_unique')
      .on(t.bucketId, t.round)
      .where(sql`counted = 0`),
  ],
)

/**
 * Feed high-water mark per (day, bucket): the end-of-day global position
 * ((round-1) * word_count + pointer). A day's word count is the difference
 * of consecutive snapshots — never derived from per-card events.
 */
export const dailyPointer = sqliteTable(
  'daily_pointer',
  {
    day: text('day').notNull(),
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id, { onDelete: 'cascade' }),
    globalPosition: integer('global_position').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.bucketId] })],
)

/** Daily time tracking: feed/study seconds and whole-app seconds. */
export const dailyStat = sqliteTable('daily_stat', {
  day: text('day').primaryKey(),
  feedSeconds: integer('feed_seconds').notNull().default(0),
  appSeconds: integer('app_seconds').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
})

export type BucketRow = typeof bucket.$inferSelect
export type WordRow = typeof word.$inferSelect
export type BucketProgressRow = typeof bucketProgress.$inferSelect
export type RoundFlagRow = typeof roundFlag.$inferSelect
export type RoundHistoryRow = typeof roundHistory.$inferSelect
export type ReviewSessionRow = typeof reviewSession.$inferSelect
export type DailyPointerRow = typeof dailyPointer.$inferSelect
export type DailyStatRow = typeof dailyStat.$inferSelect
