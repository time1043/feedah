import { drizzle } from 'drizzle-orm/expo-sqlite'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import * as SQLite from 'expo-sqlite'

import migrations from '../../drizzle/migrations'
import { seedBuckets } from './seed'

const DB_NAME = 'feedah.db'

let rawDb: SQLite.SQLiteDatabase | null = null
let currentDb: Db | null = null

function buildDb(raw: SQLite.SQLiteDatabase) {
  return drizzle(raw)
}

export type Db = ReturnType<typeof buildDb>

/**
 * Runs async drizzle statements inside one native transaction. Drizzle's own
 * `db.transaction` commits before an async callback resolves, so the raw
 * handle's withTransactionAsync is the only safe umbrella here.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  if (!rawDb || !currentDb) throw new Error('database not opened')
  const db = currentDb
  let result: T | undefined
  await rawDb.withTransactionAsync(async () => {
    result = await fn(db)
  })
  return result as T
}

let instance: Promise<Db> | null = null

/** Opens the database once; migrations and seeding run on first open. */
export function getDb(): Promise<Db> {
  if (!instance) {
    instance = (async () => {
      const raw = SQLite.openDatabaseSync(DB_NAME)
      rawDb = raw
      currentDb = buildDb(raw)
      await raw.execAsync('PRAGMA journal_mode = WAL')
      // Enforce the declared foreign keys (off by default in SQLite) and
      // tolerate brief lock contention between concurrent writes.
      await raw.execAsync('PRAGMA foreign_keys = ON')
      await raw.execAsync('PRAGMA busy_timeout = 3000')
      await migrate(currentDb, migrations)
      await seedBuckets(currentDb)
      return currentDb
    })().catch((error) => {
      // A failed open must not poison the singleton: clear it so the next
      // call retries instead of failing for the whole session.
      instance = null
      throw error
    })
  }
  return instance
}
