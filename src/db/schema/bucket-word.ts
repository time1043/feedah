import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { Distractor } from '@/types/bucket'

export const bucket = sqliteTable('bucket', {
  name: text('name').primaryKey(),
  wordCount: integer('word_count').notNull(),
  /** Hash of the seeded word content — the seed idempotency key sits next
   * to word_count, so data-only changes (edited meanings) re-seed too. */
  contentHash: text('content_hash').notNull().default(''),
  /** Deletion tombstone (epoch ms): the bucket is hidden from every list
   * but every row — and therefore its statistics contribution — stays, and
   * importing the same file again lifts the tombstone. */
  deletedAt: integer('deleted_at'),
})

export const word = sqliteTable(
  'word',
  {
    bucketName: text('bucket_name')
      .notNull()
      .references(() => bucket.name, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    word: text('word').notNull(),
    ipa: text('ipa').notNull().default(''),
    meaning: text('meaning').notNull().default(''),
    /** JSON-encoded string[] in the raw stage; a proper json column when
     * the drill stage brings typed columns. */
    forms: text('forms').notNull().default('[]'),
    /** JSON-encoded Distractor[]: the curated confusables the quiz drill
     * prefers, topped up from the bucket pool at prepare time. */
    distractors: text('distractors', { mode: 'json' })
      .$type<Distractor[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (table) => [primaryKey({ columns: [table.bucketName, table.position] })],
)
