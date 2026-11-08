import type { Bucket } from '@/types/bucket'

import bucket370 from '../../data/370.json'
import bucket700 from '../../data/700.json'
import bucket2050 from '../../data/2050.json'

/** The mock buckets, straight from data/*.json until the drizzle schema
 * replaces them. */
export const buckets: Bucket[] = [bucket2050, bucket370, bucket700]

/** Looks a bucket up by name, falling back to the first one. */
export function findBucketByName(name: string): Bucket {
  return buckets.find((bucket) => bucket.name === name) ?? buckets[0]
}
