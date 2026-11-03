// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20261027192445_loose_khan/migration.sql'
import m0001 from './20261030002433_sloppy_outlaw_kid/migration.sql'
import m0002 from './20261103093000_bucket_deleted_at/migration.sql'

export default {
  migrations: {
    '20261027192445_loose_khan': m0000,
    '20261030002433_sloppy_outlaw_kid': m0001,
    '20261103093000_bucket_deleted_at': m0002,
  },
}
