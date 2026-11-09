import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const bucket = sqliteTable('bucket', {
  name: text('name').primaryKey(),
  wordCount: integer('word_count').notNull(),
  /** Hash of the seeded word content — the seed idempotency key sits next
   * to word_count, so data-only changes (edited meanings) re-seed too. */
  contentHash: text('content_hash').notNull().default(''),
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
  },
  (table) => [primaryKey({ columns: [table.bucketName, table.position] })],
)
