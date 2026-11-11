//
// In-memory SQLite harness for the repo logic: node's built-in sqlite engine
// (node >= 22.5) drives the exact drizzle migration DDL, so the real query
// code runs unchanged. Test files swap '@/db/index' and '@/db/client' for the
// harness's factories via jest.mock.
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
  // FK enforcement off: the app's exclusive transaction umbrella runs on a
  // fresh connection where the PRAGMA does not apply (see src/db/client.ts),
  // so the write rules must hold without FK enforcement — the harness takes
  // that weaker setting for every statement.
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

/** The full public surface of '@/db/index' the tested code calls. */
export function dbIndex() {
  return {
    getDb: async () => {
      if (!currentDb) currentDb = createDb()
      return currentDb as unknown as Db
    },
    // The real wrapper runs async work inside one native transaction; a sync
    // in-memory driver cannot reproduce that, and these tests exercise write
    // rules, not atomicity.
    withTransaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      if (!currentDb) currentDb = createDb()
      return fn(currentDb as unknown as Db)
    },
  }
}

/** The slice of '@/db/client' the tested code calls — the seed's umbrella. */
export function dbClient() {
  return {
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
