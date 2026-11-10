import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bucket } from './bucket-word'

/** The study probe: one row per bucket, always describing the round being
 * studied right now. This is the table the session's "killing the app does
 * not send you back to round 1" promise lives in. */
export const bucketProgress = sqliteTable('bucket_progress', {
  bucketName: text('bucket_name')
    .primaryKey()
    .references(() => bucket.name, { onDelete: 'cascade' }),
  round: integer('round').notNull().default(1),
  pointer: integer('pointer').notNull().default(0),
  /** When the CURRENT round began; the finished ones keep their own stamp
   * in round_record (advancing the probe overwrites this). 0 = unrecorded. */
  roundStartedAt: integer('round_started_at').notNull().default(0),
})

/** One row per completed round: when it began and when it ended. The probe
 * only ever holds the live round, so this is where a finished round's span
 * survives. Written as the same transaction that advances the probe, so a
 * round never advances without its record. */
export const roundRecord = sqliteTable(
  'round_record',
  {
    bucketName: text('bucket_name')
      .notNull()
      .references(() => bucket.name, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    /** Copied from the probe's roundStartedAt (0 = unrecorded). */
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucketName, table.round] })],
)

/** A word flagged within one round of one bucket. A flag belongs to its round,
 * not to the bucket: the next round starts clean unless the completion copies
 * it forward. The row's absence IS the unflagged state, so marking is an
 * INSERT and clearing a DELETE — never a boolean column. */
export const roundFlag = sqliteTable(
  'round_flag',
  {
    bucketName: text('bucket_name')
      .notNull()
      .references(() => bucket.name, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    /** The word's card number (its position), the identifier every surface
     * shares with the deck. */
    position: integer('position').notNull(),
    flaggedAt: integer('flagged_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucketName, table.round, table.position] })],
)
