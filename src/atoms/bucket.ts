import { storedAtom } from '@/atoms/storage'

/** The bucket the home screen studies and the decks open on. */
export const activeBucketAtom = storedAtom<string>('feedah.active-bucket', '2050')
