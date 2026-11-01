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
export function storedAtom<T>(key: string, initial: T): PrimitiveAtom<T> {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => AsyncStorage),
  ) as unknown as PrimitiveAtom<T>
}
