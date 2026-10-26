/**
 * In-memory SQLite harness for the repo/mirror/snapshot logic: node's built-in
 * sqlite engine (node >= 22.5) drives the exact drizzle migration DDL, so the
 * real query code runs unchanged. Test files swap '@/db/index' for dbIndex().
 */

import { drizzle } from 'drizzle-orm/node-sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Helper params use the app's Db type: in test files getDb() is typed by the
// real '@/db/index' (expo driver), while the harness runtime object is the
// node:sqlite driver — the sqlite-core builders are identical for both.
import type { Db } from '@/db/index';

import * as schema from '@/db/schema';

type HarnessDb = ReturnType<typeof drizzle>;

let currentDb: HarnessDb | null = null;

function createDb(): HarnessDb {
  // FK enforcement off: expo-sqlite runs with SQLite's default (no PRAGMA
  // foreign_keys in src/db/index.ts), and the app relies on seeded parents.
  const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  const migrationsDir = path.join(__dirname, '..', '..', 'drizzle');
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
  for (const dir of dirs) {
    const file = path.join(migrationsDir, dir, 'migration.sql');
    const sql = fs.readFileSync(file, 'utf8').split('--> statement-breakpoint').join('');
    sqlite.exec(sql);
  }
  return drizzle({ client: sqlite });
}

/** The full public surface of '@/db/index' the app code may call. */
export function dbIndex() {
  return {
    getDb: async (): Promise<HarnessDb> => {
      if (!currentDb) currentDb = createDb();
      return currentDb;
    },
    // The real wrapper runs async work inside a native transaction; a sync
    // in-memory driver cannot reproduce that, and these tests exercise merge
    // logic, not atomicity.
    withTransaction: async <T>(fn: (tx: HarnessDb) => Promise<T>): Promise<T> => {
      if (!currentDb) currentDb = createDb();
      return fn(currentDb);
    },
    getRawDb: () => null,
    resetDatabase: async () => {
      currentDb = null;
    },
  };
}

/** Drops the current in-memory database; the next getDb() starts fresh. */
export function resetDb(): void {
  currentDb = null;
}

/** Inserts a bucket with its progress row (round 1, pointer 0). */
export async function seedBucket(db: Db, id: string, wordCount: number): Promise<void> {
  await db.insert(schema.bucket).values({ id, wordCount });
  await db
    .insert(schema.bucketProgress)
    .values({ bucketId: id })
    .onConflictDoNothing({ target: schema.bucketProgress.bucketId });
}

/** Inserts `count` trivial words for a bucket, positions 1..count. */
export async function seedWords(db: Db, bucketId: string, count: number): Promise<void> {
  await db.insert(schema.word).values(
    Array.from({ length: count }, (_, i) => ({
      bucketId,
      position: i + 1,
      text: `word${i + 1}`,
      ipa: '',
      meaning: `meaning ${i + 1}`,
      forms: [] as string[],
    })),
  );
}
