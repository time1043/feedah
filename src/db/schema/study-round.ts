import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bucket } from './bucket-word'

/** The study probe: one row per bucket. This is the table the session's
 * "killing the app does not send you back to round 1" promise lives in.
 * Flags are a separate concern and get their own table when they land. */
export const bucketProgress = sqliteTable('bucket_progress', {
  bucketName: text('bucket_name')
    .primaryKey()
    .references(() => bucket.name, { onDelete: 'cascade' }),
  round: integer('round').notNull().default(1),
  pointer: integer('pointer').notNull().default(0),
  roundStartedAt: integer('round_started_at').notNull().default(0),
})
