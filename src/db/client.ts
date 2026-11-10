import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as SQLite from 'expo-sqlite'

export const DB_NAME = 'feedah.db'

function buildDb(raw: SQLite.SQLiteDatabase) {
  return drizzle(raw)
}

export type Db = ReturnType<typeof buildDb>

let rawDb: SQLite.SQLiteDatabase | null = null
let currentDb: Db | null = null

/** The raw expo-sqlite handle behind drizzle; used by the dev studio plugin. */
export function getRawDb(): SQLite.SQLiteDatabase | null {
  return rawDb
}

/**
 * Runs async drizzle statements inside one native transaction. Drizzle's own
 * `db.transaction` commits before an async callback resolves, so the raw
 * handle's exclusive transaction is the only safe umbrella here — and the
 * exclusive variant is the documented one: withTransactionAsync can be
 * interrupted by overlapping async queries on the same connection, whose
 * "within a transaction" error rolls back OUR work too.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  if (!rawDb || !currentDb) throw new Error('database not opened')
  const db = currentDb
  let result: T | undefined
  await rawDb.withExclusiveTransactionAsync(async () => {
    result = await fn(db)
  })
  return result as T
}

/** Opens the raw handle, wraps it in drizzle and applies the PRAGMAs. The
 * singleton state lives here so withTransaction can always find it. */
export async function openDb(): Promise<{ raw: SQLite.SQLiteDatabase; db: Db }> {
  // Change listeners let drizzle's useLiveQuery subscribe to writes; they
  // must be enabled at open time, retrofitting means reopening the file.
  const raw = SQLite.openDatabaseSync(DB_NAME, { enableChangeListener: true })
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
