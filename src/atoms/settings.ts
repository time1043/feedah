import type { PrimitiveAtom } from 'jotai'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

const storage = createJSONStorage(() => AsyncStorage)

/**
 * AsyncStorage-backed atom. jotai types reads of an async storage as
 * `T | Promise<T>`; at runtime the atom starts at `initial`, hydrates within
 * the first frame, and every write happens long after — so reads are
 * surfaced as plain T.
 */
function storedAtom<T>(key: string, initial: T): PrimitiveAtom<T> {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => AsyncStorage),
  ) as unknown as PrimitiveAtom<T>
}

/** The bucket the home screen studies and the decks open on. */
export const activeBucketAtom = storedAtom<string>('feedah.active-bucket', '2050')

/** Whether the word list shows the meaning column (default hidden). */
export const wordsMeaningAtom = storedAtom<boolean>('feedah.words-meaning', false)
