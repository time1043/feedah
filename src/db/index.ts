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
 * may be sitting there. Against such a file, migrate either fails outright
 * or, worse, considers itself up to date while the tables' shape is wrong;
 * both surface as a failed migrate-or-seed attempt, so the database is
 * deleted and recreated once before the error propagates.
 */
async function prepareDb(): Promise<Db> {
  try {
    return await openMigrateAndSeed()
  } catch {
    await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {})
    return openMigrateAndSeed()
  }
}

/** One full open-migrate-seed attempt against whatever file is there. Seed
 * is the shape verifier: a missing or mis-shaped table makes a seed
 * statement throw, so a successful seed doubles as the probe. The handle
 * is closed on failure so the wipe in prepareDb starts clean. */
async function openMigrateAndSeed(): Promise<Db> {
  const { raw, db } = await openDb()
  try {
    await migrate(db, migrations)
    await seedBuckets(db)
    return db
  } catch (error) {
    await raw.closeAsync().catch(() => {})
    throw error
  }
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
