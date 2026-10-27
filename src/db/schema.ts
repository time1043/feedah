import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const bucket = sqliteTable('bucket', {
  id: text('id').primaryKey(),
  wordCount: integer('word_count').notNull(),
})

export const word = sqliteTable(
  'word',
  {
    bucketId: text('bucket_id')
      .notNull()
      .references(() => bucket.id),
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

export type BucketRow = typeof bucket.$inferSelect
export type WordRow = typeof word.$inferSelect
