import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import * as SQLite from 'expo-sqlite'

import migrations from '../../drizzle/migrations'
import { DB_NAME, openDb, type Db } from './client'
import { seedBuckets } from './seed'

export { getRawDb, withTransaction, type Db } from './client'

/**
 * Opens the database, applies drizzle migrations and seeds the bundled
 * buckets. The file is disposable local state, and it is SHARED across Expo
 * Go projects — an MVP-era feedah.db (old schema, old migration records)
 * may be sitting there. Against such a file, migrate either fails or, worse,
 * considers itself up to date while our tables are missing; both cases are
 * detected and the database is deleted and recreated once.
 */
async function prepareDb(): Promise<Db> {
  let { raw, db } = await openDb()
  let verified = false
  try {
    await migrate(db, migrations)
    const probe = (await db.get(
      sql`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'bucket'`,
    )) as { ok: number } | undefined
    if (probe?.ok) {
      verified = true
    }
  } catch {
    // Migration failed outright — fall through to the recreate path.
  }

  if (!verified) {
    await raw.closeAsync().catch(() => {})
    await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {})
    ;({ raw, db } = await openDb())
    await migrate(db, migrations)
  }

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
