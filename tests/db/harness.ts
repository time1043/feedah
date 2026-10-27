//
// In-memory SQLite harness for the repo logic: node's built-in sqlite engine
// (node >= 22.5) drives the exact drizzle migration DDL, so the real query
// code runs unchanged. Test files swap '@/db/index' for dbIndex() via
// jest.mock.
//

import { drizzle } from 'drizzle-orm/node-sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Helper params use the app's Db type: in test files getDb() is typed by the
// real '@/db/index' (expo driver), while the harness runtime object is the
// node:sqlite driver — the sqlite-core builders are identical for both.
import type { Db } from '@/db/index'

let currentDb: ReturnType<typeof drizzle> | null = null

function createDb() {
  // FK enforcement off: expo-sqlite runs with SQLite's default (no PRAGMA
  // foreign_keys in src/db/index.ts), and the app relies on seeded parents.
  const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
  const migrationsDir = path.join(__dirname, '..', '..', 'drizzle')
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_/.test(name))
    .sort()
  for (const dir of dirs) {
    const file = path.join(migrationsDir, dir, 'migration.sql')
    const sql = fs.readFileSync(file, 'utf8').split('--> statement-breakpoint').join('')
    sqlite.exec(sql)
  }
  return drizzle({ client: sqlite })
}

/** The full public surface of '@/db/index' the app code may call. */
export function dbIndex() {
  return {
    getDb: async () => {
      if (!currentDb) currentDb = createDb()
      return currentDb
    },
    // The real wrapper runs async work inside a native transaction; a sync
    // in-memory driver cannot reproduce that, and these tests exercise write
    // rules, not atomicity. The node driver's db is cast to the app's Db —
    // the sqlite-core builders are identical for both.
    withTransaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      if (!currentDb) currentDb = createDb()
      return fn(currentDb as unknown as Db)
    },
  }
}

/** Drops the in-memory database so the next getDb() starts fresh. */
export function resetDb(): void {
  currentDb = null
}
