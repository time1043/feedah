import AsyncStorage from '@react-native-async-storage/async-storage'
import { atom, type PrimitiveAtom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

import type { Word } from '@/types/word'

/**
 * How far a bucket has been studied. `pointer` is the card currently in
 * progress — the index studying resumes from; landing on a card completes
 * the one before it, so exiting mid-card loses nothing. `round` counts
 * completed passes over the bucket.
 */
export interface StudyProgress {
  round: number
  pointer: number
}

export const DEFAULT_PROGRESS: StudyProgress = { round: 1, pointer: 0 }

/** Returns the map when the atom holds a resolved value, null mid-hydration. */
function unwrap<T extends object>(value: T | Promise<T>): T | null {
  return typeof (value as Promise<T>).then === 'function' ? null : (value as T)
}

/**
 * AsyncStorage-backed atom. jotai types reads of an async storage as
 * `T | Promise<T>`; at runtime the atom starts at `initial`, hydrates within
 * the first frame, and every write happens long after — so reads are
 * surfaced as plain T. The write helpers below still guard the one frame
 * where the value can be a Promise.
 */
function storedAtom<T>(key: string, initial: T): PrimitiveAtom<T> {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => AsyncStorage),
  ) as unknown as PrimitiveAtom<T>
}

export const activeBucketAtom = storedAtom('feedah.active-bucket', '2050')

export const progressAtom = storedAtom<Record<string, StudyProgress>>('feedah.progress', {})

/** Flagged (unfamiliar) words, keyed by `bucket:word`. */
export const flagsAtom = storedAtom<Record<string, boolean>>('feedah.flags', {})

/** A flag survives as long as the word entry does: the word text is its id. */
export const flagKey = (bucket: string, word: Word): string => `${bucket}:${word.word}`

/** Marks a card settled: moves the pointer forward, never backward. */
export const settlePointerAtom = atom(
  null,
  (_get, set, params: { bucket: string; pointer: number }) => {
    set(progressAtom, (prev) => {
      const map = unwrap(prev)
      if (!map) return prev
      const current = map[params.bucket] ?? DEFAULT_PROGRESS
      if (params.pointer <= current.pointer) return map
      return { ...map, [params.bucket]: { ...current, pointer: params.pointer } }
    })
  },
)

/** Starts the next round after the previous one was fully walked through. */
export const nextRoundAtom = atom(null, (_get, set, bucket: string) => {
  set(progressAtom, (prev) => {
    const map = unwrap(prev)
    if (!map) return prev
    const current = map[bucket] ?? DEFAULT_PROGRESS
    return { ...map, [bucket]: { round: current.round + 1, pointer: 0 } }
  })
})

export const toggleFlagAtom = atom(null, (_get, set, params: { bucket: string; word: Word }) => {
  const key = flagKey(params.bucket, params.word)
  set(flagsAtom, (prev) => {
    const map = unwrap(prev)
    if (!map) return prev
    return { ...map, [key]: !map[key] }
  })
})

/** Whether the word list shows the meaning column (default hidden). */
export const wordsMeaningAtom = storedAtom('feedah.words-meaning', false)
