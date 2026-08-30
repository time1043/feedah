import type { SQLiteDatabase } from 'expo-sqlite';

/** Sequential schema migrations; index + 1 becomes PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS bucket (
    id TEXT PRIMARY KEY,
    word_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS word (
    bucket_id TEXT NOT NULL REFERENCES bucket(id),
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    ipa TEXT NOT NULL DEFAULT '',
    meaning TEXT NOT NULL DEFAULT '',
    forms TEXT NOT NULL DEFAULT '[]',
    flagged INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_id, position)
  );

  CREATE TABLE IF NOT EXISTS bucket_progress (
    bucket_id TEXT PRIMARY KEY REFERENCES bucket(id),
    round INTEGER NOT NULL DEFAULT 1,
    pointer INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL DEFAULT 0
  );

  -- Per-round per-word state. reached=1 means the card was settled by hand
  -- in that round (jump targets never count). flagged=1 marks the flag was
  -- on at some point during the round; rows may exist with reached=0 when
  -- the word was flagged without being reached (e.g. from search).
  CREATE TABLE IF NOT EXISTS round_word (
    bucket_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    position INTEGER NOT NULL,
    reached INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_id, round, position)
  );

  CREATE TABLE IF NOT EXISTS round_history (
    bucket_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,
    PRIMARY KEY (bucket_id, round)
  );

  CREATE TABLE IF NOT EXISTS daily_stat (
    day TEXT PRIMARY KEY,
    feed_seconds INTEGER NOT NULL DEFAULT 0,
    app_seconds INTEGER NOT NULL DEFAULT 0
  );

  -- Latest high-water global position ((round-1)*word_count + pointer) per
  -- bucket per active day; daily word count is the difference of consecutive
  -- snapshots. Rows are written only when the pointer advances.
  CREATE TABLE IF NOT EXISTS daily_pointer (
    day TEXT NOT NULL,
    bucket_id TEXT NOT NULL,
    global_position INTEGER NOT NULL,
    PRIMARY KEY (day, bucket_id)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_word_flag ON word (bucket_id, flagged);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
