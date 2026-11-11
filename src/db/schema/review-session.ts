import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { bucket } from './bucket-word'

/**
 * One review walk-through of one round's flag list. While the round's feed
 * is still unfinished the session is a draft (counted = 0, number null) —
 * resumable, never counted, at most one per round (the partial unique index
 * enforces that). Once the feed completes, the next entry discards the draft
 * (抹零) and opens a counted session whose number sticks: the round's real
 * walk-throughs number from 1 and only grow.
 */
export const reviewSession = sqliteTable(
  'review_session',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bucketName: text('bucket_name')
      .notNull()
      .references(() => bucket.name, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    /** The real walk-through flag; a draft is never promoted, it is discarded. */
    counted: integer('counted', { mode: 'boolean' }).notNull().default(false),
    /** The counted session's 1-based number; null for a draft. Immutable once
     * written — the number is earned by the feed having completed. */
    number: integer('number'),
    /** JSON-encoded number[]: the frozen flag positions, ascending. The walk
     * replays the snapshot, not the live flag list. */
    queue: text('queue', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),
    /** The resume watermark: the highest word position settled so far. */
    lastPosition: integer('last_position').notNull().default(0),
    startedAt: integer('started_at').notNull(),
    /** Set when a counted walk reaches its end; a finishing draft deletes the
     * row instead, so an open session (finishedAt null) is either kind. */
    finishedAt: integer('finished_at'),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (table) => [
    index('idx_review_session_round').on(table.bucketName, table.round),
    uniqueIndex('review_session_draft_unique')
      .on(table.bucketName, table.round)
      .where(sql`counted = 0`),
  ],
)

/** One row as the session layer carries it. */
export type ReviewSessionRow = typeof reviewSession.$inferSelect
