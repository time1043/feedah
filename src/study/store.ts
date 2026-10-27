import AsyncStorage from '@react-native-async-storage/async-storage'
import { atom, type PrimitiveAtom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

import { todayLocalDate } from '@/lib/date'
import {
  addFeedSeconds,
  completeReviewSession,
  setRoundFlag,
  settleCard,
} from '@/study/logic'
import { EMPTY_STUDY_STATE, type StudyState } from '@/study/types'

/**
 * Returns the map when the atom holds a resolved value, null mid-hydration.
 * jotai types reads of an async storage as `T | Promise<T>`; at runtime the
 * atom starts at `initial`, hydrates within the first frame, and every write
 * happens long after — so reads are surfaced as plain T. The write helpers
 * below still guard the one frame where the value can be a Promise.
 */
export function unwrap<T extends object>(value: T | Promise<T>): T | null {
  return typeof (value as Promise<T>).then === 'function' ? null : (value as T)
}

function storedAtom<T>(key: string, initial: T): PrimitiveAtom<T> {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => AsyncStorage),
  ) as unknown as PrimitiveAtom<T>
}

/**
 * The single persisted study state. Writes go through the action atoms below,
 * which apply the pure transitions from logic.ts; reads pair the state with
 * those functions directly (see the screens).
 */
export const studyStateAtom = storedAtom<StudyState>('feedah.study-state', EMPTY_STUDY_STATE)

export interface SettleParams {
  bucketId: string
  wordCount: number
  position: number
}

/** Settles a card in the round being fed (see logic.settleCard). */
export const settleCardAtom = atom(null, (_get, set, params: SettleParams) => {
  set(studyStateAtom, (prev) => {
    const state = unwrap(prev)
    if (!state) return prev
    return settleCard(state, { ...params, at: Date.now() })
  })
})

export interface FlagParams {
  bucketId: string
  /** The flag context: the round being fed or the round a review derives from. */
  round: number
  position: number
  flagged: boolean
}

/** Flags/unflags a word in one round's list (see logic.setRoundFlag). */
export const setRoundFlagAtom = atom(null, (_get, set, params: FlagParams) => {
  set(studyStateAtom, (prev) => {
    const state = unwrap(prev)
    if (!state) return prev
    return setRoundFlag(state, params)
  })
})

export interface ReviewSessionParams {
  bucketId: string
  round: number
  wordCount: number
  listSize: number
  position: number
  startedAt: number
}

/** Archives a finished review pass (see logic.completeReviewSession). */
export const completeReviewSessionAtom = atom(null, (_get, set, params: ReviewSessionParams) => {
  set(studyStateAtom, (prev) => {
    const state = unwrap(prev)
    if (!state) return prev
    return completeReviewSession(state, { ...params, finishedAt: Date.now() })
  })
})

/** Accrues studying seconds into today's total. */
export const addFeedSecondsAtom = atom(null, (_get, set, params: { seconds: number }) => {
  set(studyStateAtom, (prev) => {
    const state = unwrap(prev)
    if (!state) return prev
    return addFeedSeconds(state, { day: todayLocalDate(), seconds: params.seconds })
  })
})
