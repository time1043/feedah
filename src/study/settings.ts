import AsyncStorage from '@react-native-async-storage/async-storage'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

function storedAtom<T>(key: string, initial: T) {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => AsyncStorage),
  )
}

/**
 * User preferences. Small enough to live as individual atoms; the study state
 * gets the single-blob treatment in store.ts because its writes are transact-
 * ional (one settle touches several tables).
 */

/** The bucket the home screen and mode screens operate on by default. */
export const activeBucketAtom = storedAtom('feedah.active-bucket', '2050')

/** Whether the word list shows the meaning column (default hidden). */
export const wordsMeaningAtom = storedAtom('feedah.words-meaning', false)

/**
 * The bottom-corner readouts of the study screens (round/time on the left,
 * position progress on the right). Subtle by design and easy to turn off.
 */
export const studyReadoutsAtom = storedAtom('feedah.study-readouts', true)

/**
 * Buckets the global search covers (e.g. only 2050 and 700). null = every
 * bucket; once user-imported buckets exist this is how they opt in or out.
 */
export const globalSearchBucketsAtom = storedAtom<string[] | null>(
  'feedah.global-search-buckets',
  null,
)

/**
 * Whether searching from inside a bucket context (feed, review, browse) is
 * scoped to that bucket instead of the global scope. On by default, matching
 * the natural expectation of looking something up in the bucket at hand.
 */
export const bucketLocalSearchAtom = storedAtom('feedah.bucket-local-search', true)
