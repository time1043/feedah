/**
 * The study domain: everything the app records about learning, kept as plain
 * data so the pure transitions in logic.ts can be tested without React,
 * AsyncStorage, or (later) SQLite. The shape deliberately mirrors the future
 * database tables — one top-level key per table.
 */

/** Per-bucket probe: which round is being fed and how far it has flowed. */
export interface BucketProgress {
  /** 1-based; the round currently being fed. */
  round: number
  /**
   * High-water mark: the 1-based position of the last card settled by hand in
   * the current round. 0 = nothing settled yet. Only ever moves forward; a
   * round is complete when it reaches the bucket's word count.
   */
  pointer: number
  /** First settle timestamp of the current round (0 = round not started). */
  startedAt: number
}

/** Per-round, per-word state — the future round_word table row. */
export interface RoundWordState {
  /** The card was settled by hand in this round (scrub/jump targets never count). */
  reached: boolean
  /**
   * The word is flagged in this round's flag list. Each round owns an
   * independent list: flagging during round 2 says nothing about round 1.
   * A word can be flagged without being reached (flagged from search/browse).
   */
  flagged: boolean
  /** When the card was settled (0 if never). */
  reachedAt: number
}

/** A completed round: the probe is gone, the record stays. */
export interface RoundHistoryEntry {
  /** First settle of the round (= when its feed started flowing). */
  startedAt: number
  /** The settle that pushed the pointer to the last word. */
  finishedAt: number
}

/**
 * A finished review pass over one round's flag list. Sessions of a round that
 * has not been fully fed yet are still recorded (the day log shows them) but
 * carry counted: false — they never advance the round's time counter.
 */
export interface ReviewSession {
  bucketId: string
  round: number
  /** The "time N" label the session ran under: counted sessions so far + 1. */
  time: number
  /** Whether the session incremented the time counter (round was fully fed). */
  counted: boolean
  /** Local day (YYYY-MM-DD) the session completed on. */
  day: string
  startedAt: number
  finishedAt: number
  /** How many cards the flag list held when the session was snapshotted. */
  listSize: number
  /** Highest card index settled in the session (1-based, within the list). */
  position: number
}

/** Per-day studying time — the future daily_stat row. */
export interface DayStat {
  feedSeconds: number
}

/**
 * The whole study state. Maps are keyed by string ids (bucket id, YYYY-MM-DD
 * day) or numbers (round, 1-based word position).
 */
export interface StudyState {
  progress: Record<string, BucketProgress>
  /** roundWords[bucketId][round][position] */
  roundWords: Record<string, Record<number, Record<number, RoundWordState>>>
  /** roundHistory[bucketId][round] */
  roundHistory: Record<string, Record<number, RoundHistoryEntry>>
  /** reviewTimes[bucketId][round] = counted review sessions. */
  reviewTimes: Record<string, Record<number, number>>
  reviewSessions: ReviewSession[]
  /** dailyPointers[day][bucketId] = global position high-water of that day. */
  dailyPointers: Record<string, Record<string, number>>
  /** dailyStat[day] */
  dailyStat: Record<string, DayStat>
}

export const EMPTY_STUDY_STATE: StudyState = {
  progress: {},
  roundWords: {},
  roundHistory: {},
  reviewTimes: {},
  reviewSessions: [],
  dailyPointers: {},
  dailyStat: {},
}

/** Green = reached, red = flagged, gray = never reached in that round. */
export type RoundWordStatus = 'green' | 'red' | 'gray'

/** One row of the bucket detail's round list. */
export interface RoundRecord {
  round: number
  /** First settle of the round; 0 while the round has not started flowing. */
  startedAt: number
  /** The settle that finished the round; null while it is still in progress. */
  finishedAt: number | null
  /** Calendar days spanned (inclusive), 0 when the round has not started. */
  days: number
  done: boolean
  pointer: number
  statuses: RoundWordStatus[]
  green: number
  red: number
}

/** Aggregated per-day usage for the stats page. */
export interface DailyUsage {
  words: number
  feedSeconds: number
}

/** What was fed of one bucket on one day, in round/position terms. */
export interface DailyFeedRange {
  day: string
  round: number
  /** 1-based inclusive position range fed that day within the round. */
  from: number
  to: number
}
