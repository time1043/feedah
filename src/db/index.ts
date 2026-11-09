import * as SQLite from 'expo-sqlite'

import { seedBuckets } from './seed'

const DB_NAME = 'feedah.db'

/** The schema version, bumped by hand as the DDL evolves. This is the
 * raw-stage stand-in for drizzle's __drizzle_migrations table. */
const SCHEMA_VERSION = 1

const DDL = `
CREATE TABLE IF NOT EXISTS bucket (
  id TEXT PRIMARY KEY,
  word_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS word (
  bucket_id TEXT NOT NULL REFERENCES bucket (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  word TEXT NOT NULL,
  ipa TEXT NOT NULL DEFAULT '',
  meaning TEXT NOT NULL DEFAULT '',
  forms TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (bucket_id, position)
);
`

/**
 * Opens the database once: applies the PRAGMAs, creates the tables when the
 * schema version moves, and seeds nothing here (the seed owns its data).
 * The file is disposable local state shared across Expo Go projects — the
 * user_version guard makes a stale or foreign file self-heal by re-running
 * the idempotent DDL.
 */
async function prepareDb(): Promise<SQLite.SQLiteDatabase> {
  const db = SQLite.openDatabaseSync(DB_NAME)
  // WAL for concurrent read/write, FK enforcement (off by default in
  // SQLite), and a grace period for brief lock contention.
  await db.execAsync('PRAGMA journal_mode = WAL')
  await db.execAsync('PRAGMA foreign_keys = ON')
  await db.execAsync('PRAGMA busy_timeout = 3000')

  const { user_version: current } = (await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  )) as { user_version: number }
  if (current < SCHEMA_VERSION) {
    await db.execAsync(DDL)
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }

  await seedBuckets()

  return db
}

let instance: Promise<SQLite.SQLiteDatabase> | null = null

/** Opens the database once; a failed open must not poison the singleton. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!instance) {
    instance = prepareDb().catch((error) => {
      instance = null
      throw error
    })
  }
  return instance
}
