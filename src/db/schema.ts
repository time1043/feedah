import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const bucket = sqliteTable('bucket', {
  id: text('id').primaryKey(),
  wordCount: integer('word_count').notNull(),
});

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
    flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.bucketId, t.position] }),
    index('idx_word_flag').on(t.bucketId, t.flagged),
  ],
);

export const bucketProgress = sqliteTable('bucket_progress', {
  bucketId: text('bucket_id')
    .primaryKey()
    .references(() => bucket.id),
  round: integer('round').notNull().default(1),
  pointer: integer('pointer').notNull().default(0),
  startedAt: integer('started_at').notNull().default(0),
});

// Per-round per-word state. reached=true means the card was settled by hand
// in that round (jump targets never count). flagged=true marks the flag was
// on at some point during the round; rows may exist with reached=false when
// the word was flagged without being reached (e.g. from search). reachedAt
// records the settle time; 0 means it cannot be attributed to a day.
export const roundWord = sqliteTable(
  'round_word',
  {
    bucketId: text('bucket_id').notNull(),
    round: integer('round').notNull(),
    position: integer('position').notNull(),
    reached: integer('reached', { mode: 'boolean' }).notNull().default(false),
    flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
    reachedAt: integer('reached_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucketId, t.round, t.position] })],
);

export const roundHistory = sqliteTable(
  'round_history',
  {
    bucketId: text('bucket_id').notNull(),
    round: integer('round').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.bucketId, t.round] })],
);

export const dailyStat = sqliteTable('daily_stat', {
  day: text('day').primaryKey(),
  feedSeconds: integer('feed_seconds').notNull().default(0),
  appSeconds: integer('app_seconds').notNull().default(0),
});

// Latest high-water global position ((round-1)*word_count + pointer) per
// bucket per active day; daily word count is the difference of consecutive
// snapshots. Rows are written only when the pointer advances.
export const dailyPointer = sqliteTable(
  'daily_pointer',
  {
    day: text('day').notNull(),
    bucketId: text('bucket_id').notNull(),
    globalPosition: integer('global_position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.day, t.bucketId] })],
);

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type BucketRow = typeof bucket.$inferSelect;
export type WordSelect = typeof word.$inferSelect;
export type BucketProgressSelect = typeof bucketProgress.$inferSelect;
export type RoundWordSelect = typeof roundWord.$inferSelect;
export type RoundHistorySelect = typeof roundHistory.$inferSelect;
export type DailyStatSelect = typeof dailyStat.$inferSelect;
export type DailyPointerSelect = typeof dailyPointer.$inferSelect;
export type MetaSelect = typeof meta.$inferSelect;
