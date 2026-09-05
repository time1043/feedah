import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as SQLite from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { seedBuckets } from './seed';

const DB_NAME = 'feedah.db';

let rawDb: SQLite.SQLiteDatabase | null = null;

/** The raw expo-sqlite handle behind drizzle; needed by the dev studio plugin. */
export function getRawDb(): SQLite.SQLiteDatabase | null {
  return rawDb;
}

let instance: Promise<SQLite.SQLiteDatabase> | null = null;

function open(): SQLite.SQLiteDatabase {
  rawDb = SQLite.openDatabaseSync(DB_NAME);
  return rawDb;
}

/**
 * One-time reset: databases created before drizzle (user-version tracked) are
 * deleted instead of migrated — their schema conflicts with drizzle migrations
 * and the state is disposable (progress/flags are re-derived from bundled
 * buckets; the cloud account layer supersedes local-only history later).
 */
async function resetLegacyDatabase(db: SQLite.SQLiteDatabase): Promise<SQLite.SQLiteDatabase> {
  const ours = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('meta', 'bucket')",
  );
  const drizzled = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );
  if ((ours?.n ?? 0) > 0 && (drizzled?.n ?? 0) === 0) {
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(DB_NAME);
    return open();
  }
  return db;
}

/** Opens the database once; migrations and seeding run on first open. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!instance) {
    instance = (async () => {
      let db = open();
      await db.execAsync('PRAGMA journal_mode = WAL');
      db = await resetLegacyDatabase(db);
      await migrate(drizzle(db), migrations);
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
  if (instance) {
    const db = await instance;
    await db.closeAsync();
  }
  instance = null;
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
