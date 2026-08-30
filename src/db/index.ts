import * as SQLite from 'expo-sqlite';

import { migrate } from './schema';
import { seedBuckets } from './seed';

let instance: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens the database once; migrations and seeding run on first open. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!instance) {
    instance = (async () => {
      const db = await SQLite.openDatabaseAsync('feedah.db');
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrate(db);
      await seedBuckets(db);
      return db;
    })();
  }
  return instance;
}
