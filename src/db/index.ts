import { sql } from 'drizzle-orm'
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

/**
 * Opens the database, applies migrations and seeds the bundled buckets. The
 * file is disposable local state, and it is SHARED across Expo Go projects —
 * an MVP-era feedah.db (old schema, old drizzle migration records) may be
 * sitting there. Against such a file, migrate either fails or, worse,
 * considers itself up to date while our tables are missing; both cases are
 * detected and the database is deleted and recreated once.
 */
async function prepareDb(): Promise<Db> {
  const open = async (): Promise<{ raw: SQLite.SQLiteDatabase; db: Db }> => {
    const raw = SQLite.openDatabaseSync(DB_NAME)
    const db = buildDb(raw)
    rawDb = raw
    currentDb = db
    // Enforce the declared foreign keys (off by default in SQLite) and
    // tolerate brief lock contention between concurrent writes.
    await raw.execAsync('PRAGMA journal_mode = WAL')
    await raw.execAsync('PRAGMA foreign_keys = ON')
    await raw.execAsync('PRAGMA busy_timeout = 3000')
    return { raw, db }
  }

  let { raw, db } = await open()
  try {
    await migrate(db, migrations)
    const probe = (await db.get(
      sql`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'review_session'`,
    )) as { ok: number } | undefined
    if (probe?.ok) return db
  } catch {
    // Migration failed outright — fall through to the recreate path.
  }
  await raw.closeAsync().catch(() => {})
  await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {})
  ;({ raw, db } = await open())
  await migrate(db, migrations)
  await seedBuckets(db)
  return db
}

let instance: Promise<Db> | null = null

/** Opens the database once; migrations and seeding run on first open. */
export function getDb(): Promise<Db> {
  if (!instance) {
    instance = prepareDb().catch((error) => {
      // A failed open must not poison the singleton: clear it so the next
      // call retries instead of failing for the whole session.
      instance = null
      throw error
    })
  }
  return instance
}
