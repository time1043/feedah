import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { bucket } from './bucket-word'

/**
 * Feed high-water mark per (day, bucket): the end-of-day global position
 * ((round-1) * word_count + pointer). A day's word count is the difference
 * of consecutive snapshots — never derived from per-card events, so
 * re-viewing earlier cards never inflates the numbers.
 */
export const dailyPointer = sqliteTable(
  'daily_pointer',
  {
    day: text('day').notNull(),
    bucketName: text('bucket_name')
      .notNull()
      .references(() => bucket.name, { onDelete: 'cascade' }),
    globalPosition: integer('global_position').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.bucketName] })],
)

/** Daily time tracking: study-deck seconds and whole-app seconds. */
export const dailyStat = sqliteTable('daily_stat', {
  day: text('day').primaryKey(),
  feedSeconds: integer('feed_seconds').notNull().default(0),
  appSeconds: integer('app_seconds').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
})
