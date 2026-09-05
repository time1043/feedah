import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { seedBuckets } from './seed';

const DB_NAME = 'feedah.db';

let rawDb: SQLite.SQLiteDatabase | null = null;
let currentDb: Db | null = null;

/** The raw expo-sqlite handle behind drizzle; needed by the dev studio plugin. */
export function getRawDb(): SQLite.SQLiteDatabase | null {
  return rawDb;
}

function open(): { raw: SQLite.SQLiteDatabase; db: Db } {
  rawDb = SQLite.openDatabaseSync(DB_NAME);
  const db = buildDb(rawDb);
  currentDb = db;
  return { raw: rawDb, db };
}

function buildDb(raw: SQLite.SQLiteDatabase) {
  return drizzle(raw);
}

export type Db = ReturnType<typeof buildDb>;

/**
 * Runs async drizzle statements inside one native transaction. Drizzle's own
 * `db.transaction` (rc.4) commits before an async callback resolves, so the
 * raw handle's withTransactionAsync is the only safe umbrella here.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  if (!rawDb || !currentDb) throw new Error('database not opened');
  const db = currentDb;
  let result: T | undefined;
  await rawDb.withTransactionAsync(async () => {
    result = await fn(db);
  });
  return result as T;
}

/**
 * One-time reset: databases created before drizzle (user-version tracked) are
 * deleted instead of migrated — their schema conflicts with drizzle migrations
 * and the state is disposable (progress/flags are re-derived from bundled
 * buckets; the cloud account layer supersedes local-only history later).
 */
async function resetLegacyDatabase(raw: SQLite.SQLiteDatabase): Promise<SQLite.SQLiteDatabase> {
  const ours = await raw.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('meta', 'bucket')",
  );
  const drizzled = await raw.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );
  if ((ours?.n ?? 0) > 0 && (drizzled?.n ?? 0) === 0) {
    await raw.closeAsync();
    await SQLite.deleteDatabaseAsync(DB_NAME);
    return open().raw;
  }
  return raw;
}

let instance: Promise<Db> | null = null;

/** Opens the database once; migrations and seeding run on first open. */
export function getDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      let { raw, db } = open();
      await raw.execAsync('PRAGMA journal_mode = WAL');
      raw = await resetLegacyDatabase(raw);
      await migrate(db, migrations);
      await seedBuckets(db);
      return db;
    })().catch((error) => {
      // A failed open must not poison the singleton: clear it so the next
      // call retries instead of failing for the whole session.
      instance = null;
      throw error;
    });
  }
  return instance;
}

/** Erases everything (progress, flags, stats, settings) and re-seeds buckets. */
export async function resetDatabase(): Promise<void> {
  instance = null;
  await rawDb?.closeAsync();
  rawDb = null;
  currentDb = null;
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
