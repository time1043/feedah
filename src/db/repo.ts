import { getDb } from './index'

export type BucketRow = {
  name: string
  wordCount: number
}

/** Every seeded bucket, ordered by id. The reference's readout (round,
 * pointer, flags) joins in once the probe lives here too. */
export async function getBuckets(): Promise<BucketRow[]> {
  const db = await getDb()
  return db.getAllAsync<BucketRow>('SELECT name, word_count AS wordCount FROM bucket ORDER BY name')
}
