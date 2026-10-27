import { calendarDaysBetween, todayLocalDate } from '@/lib/date'

import type {
  BucketProgress,
  DailyFeedRange,
  DailyUsage,
  RoundRecord,
  RoundWordState,
  RoundWordStatus,
  ReviewSession,
  StudyState,
} from '@/study/types'

export const DEFAULT_PROGRESS: BucketProgress = { round: 1, pointer: 0, startedAt: 0 }

/** Global position across rounds: round 2 of a 2050-word bucket starts at 2051. */
export function globalPosition(round: number, position: number, wordCount: number): number {
  return (round - 1) * wordCount + position
}

/** Splits a global position back into its round and 1-based position. */
export function splitGlobalPosition(gp: number, wordCount: number): {
  round: number
  position: number
} {
  const round = Math.floor((gp - 1) / wordCount) + 1
  return { round, position: gp - (round - 1) * wordCount }
}

export function progressOf(state: StudyState, bucketId: string): BucketProgress {
  return state.progress[bucketId] ?? DEFAULT_PROGRESS
}

/** The round currently being fed — also the default flag context of a bucket. */
export function currentRound(state: StudyState, bucketId: string): number {
  return progressOf(state, bucketId).round
}

/**
 * A round is fully fed once its flow reached the last word. Past rounds are
 * complete by construction (a round only advances when the previous one
 * finished); the current round is complete when its pointer hit wordCount.
 */
export function isRoundComplete(
  state: StudyState,
  bucketId: string,
  round: number,
  wordCount: number,
): boolean {
  const progress = progressOf(state, bucketId)
  if (round < progress.round) return true
  if (round > progress.round) return false
  return progress.pointer >= wordCount
}

// --- Writes -----------------------------------------------------------------
// Every function takes a state and returns a new one, copying only the paths
// it touches. Callers pass `at` (epoch ms) so tests can freeze time.

/**
 * Settles a card by hand in the round being fed. The watermark only moves
 * forward: positions at or behind the pointer are ignored, and so are the
 * records of past rounds. Reaching the last word completes the round — the
 * probe moves to round N+1 at position 0 and the finished round is archived
 * with its start/finish timestamps.
 */
export function settleCard(
  state: StudyState,
  params: { bucketId: string; wordCount: number; position: number; at: number },
): StudyState {
  const { bucketId, wordCount, at } = params
  const position = Math.min(Math.max(1, Math.floor(params.position)), wordCount)
  const progress = progressOf(state, bucketId)
  if (position <= progress.pointer) return state

  const startedAt = progress.startedAt === 0 ? at : progress.startedAt
  const roundWord: RoundWordState = {
    reached: true,
    flagged: state.roundWords[bucketId]?.[progress.round]?.[position]?.flagged ?? false,
    reachedAt: at,
  }

  const progressNext: BucketProgress = { round: progress.round, pointer: position, startedAt }
  let historyNext = state.roundHistory[bucketId] ?? {}
  if (position >= wordCount) {
    historyNext = {
      ...historyNext,
      [progress.round]: { startedAt, finishedAt: at },
    }
    progressNext.round = progress.round + 1
    progressNext.pointer = 0
    progressNext.startedAt = at
  }

  const day = todayLocalDate(new Date(at))
  const gp = globalPosition(progress.round, position, wordCount)
  const previousGp = state.dailyPointers[day]?.[bucketId] ?? 0

  return {
    ...state,
    progress: { ...state.progress, [bucketId]: progressNext },
    roundWords: {
      ...state.roundWords,
      [bucketId]: {
        ...state.roundWords[bucketId],
        [progress.round]: {
          ...state.roundWords[bucketId]?.[progress.round],
          [position]: roundWord,
        },
      },
    },
    roundHistory: { ...state.roundHistory, [bucketId]: historyNext },
    dailyPointers: {
      ...state.dailyPointers,
      [day]: {
        ...state.dailyPointers[day],
        [bucketId]: Math.max(previousGp, gp),
      },
    },
  }
}

/**
 * Flags or unflags a word in ONE explicit round's flag list — the flag
 * context of the screen the user is on (the round being fed, or the round a
 * review session is derived from). Flagging marks the word unfamiliar for
 * that round whether or not it was reached; unflagging removes it from the
 * list, preserving the green record when the word was reached in that round.
 */
export function setRoundFlag(
  state: StudyState,
  params: { bucketId: string; round: number; position: number; flagged: boolean },
): StudyState {
  const { bucketId, round, position } = params
  const roundWords = state.roundWords[bucketId]?.[round] ?? {}
  const existing = roundWords[position]

  let next: RoundWordState | undefined
  if (params.flagged) {
    next = {
      reached: existing?.reached ?? false,
      flagged: true,
      reachedAt: existing?.reachedAt ?? 0,
    }
  } else if (existing) {
    // Reached words keep their green record; flag-only rows disappear.
    next = existing.reached ? { ...existing, flagged: false } : undefined
  }

  const roundNext = { ...roundWords }
  if (next) roundNext[position] = next
  else delete roundNext[position]

  return {
    ...state,
    roundWords: {
      ...state.roundWords,
      [bucketId]: { ...state.roundWords[bucketId], [round]: roundNext },
    },
  }
}

/** The round's flag list: flagged positions in bucket order. */
export function roundFlagPositions(state: StudyState, bucketId: string, round: number): number[] {
  const roundWords = state.roundWords[bucketId]?.[round] ?? {}
  return Object.keys(roundWords)
    .map(Number)
    .filter((position) => roundWords[position].flagged)
    .sort((a, b) => a - b)
}

/** Counted review sessions of a round — the "time N" counter. */
export function reviewTimesOf(state: StudyState, bucketId: string, round: number): number {
  return state.reviewTimes[bucketId]?.[round] ?? 0
}

/** The "time N" label a review session of this round runs under right now. */
export function nextReviewTime(state: StudyState, bucketId: string, round: number): number {
  return reviewTimesOf(state, bucketId, round) + 1
}

/**
 * Archives a completed review pass. The counter only advances for rounds
 * whose feed has flowed to the end: reviewing mid-round is allowed (the
 * session is still logged for the day) but deliberately not counted — the
 * count would say nothing about a list that is still growing. The first
 * completed pass after the round finished is therefore "time 1", and every
 * mid-round pass before it is zeroed out.
 */
export function completeReviewSession(
  state: StudyState,
  params: {
    bucketId: string
    round: number
    wordCount: number
    listSize: number
    position: number
    startedAt: number
    finishedAt: number
  },
): StudyState {
  const { bucketId, round } = params
  const counted = isRoundComplete(state, bucketId, round, params.wordCount)
  const time = nextReviewTime(state, bucketId, round)
  const session: ReviewSession = {
    bucketId,
    round,
    time,
    counted,
    day: todayLocalDate(new Date(params.finishedAt)),
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    listSize: params.listSize,
    position: params.position,
  }

  const timesNext = { ...state.reviewTimes[bucketId] }
  if (counted) timesNext[round] = time

  return {
    ...state,
    reviewTimes: { ...state.reviewTimes, [bucketId]: timesNext },
    reviewSessions: [...state.reviewSessions, session],
  }
}

/** Accums study seconds into a day's total. */
export function addFeedSeconds(
  state: StudyState,
  params: { day: string; seconds: number },
): StudyState {
  const existing = state.dailyStat[params.day] ?? { feedSeconds: 0 }
  return {
    ...state,
    dailyStat: {
      ...state.dailyStat,
      [params.day]: { ...existing, feedSeconds: existing.feedSeconds + params.seconds },
    },
  }
}

// --- Reads ------------------------------------------------------------------

/** Green/red/gray status of every word of a round, in bucket order. */
export function roundStatuses(
  state: StudyState,
  bucketId: string,
  round: number,
  wordCount: number,
): RoundWordStatus[] {
  const roundWords = state.roundWords[bucketId]?.[round] ?? {}
  const statuses: RoundWordStatus[] = Array.from({ length: wordCount }, () => 'gray')
  for (let position = 1; position <= wordCount; position++) {
    const word = roundWords[position]
    if (!word) continue
    statuses[position - 1] = word.flagged ? 'red' : word.reached ? 'green' : 'gray'
  }
  return statuses
}

export function roundCounts(
  state: StudyState,
  bucketId: string,
  round: number,
  wordCount: number,
): { green: number; red: number } {
  let green = 0
  let red = 0
  for (const status of roundStatuses(state, bucketId, round, wordCount)) {
    if (status === 'green') green += 1
    else if (status === 'red') red += 1
  }
  return { green, red }
}

/**
 * Every round of a bucket with its display data, oldest first — the bucket
 * detail's round list. The current round appears while in progress; its
 * finishedAt is null and its days keep growing until it completes.
 */
export function roundRecords(
  state: StudyState,
  params: { bucketId: string; wordCount: number; now: number },
): RoundRecord[] {
  const { bucketId, wordCount, now } = params
  const progress = progressOf(state, bucketId)
  const records: RoundRecord[] = []
  for (let round = 1; round <= progress.round; round++) {
    const history = state.roundHistory[bucketId]?.[round]
    const startedAt = history ? history.startedAt : round === progress.round ? progress.startedAt : 0
    const finishedAt = history ? history.finishedAt : null
    const { green, red } = roundCounts(state, bucketId, round, wordCount)
    records.push({
      round,
      startedAt,
      finishedAt,
      days: startedAt > 0 ? calendarDaysBetween(startedAt, finishedAt ?? now) : 0,
      done: isRoundComplete(state, bucketId, round, wordCount),
      pointer: history ? wordCount : round === progress.round ? progress.pointer : 0,
      statuses: roundStatuses(state, bucketId, round, wordCount),
      green,
      red,
    })
  }
  return records
}

/**
 * Daily usage for the stats page. Word counts come from the difference of
 * consecutive daily high-water snapshots (never from per-card events), so
 * re-viewing earlier cards never inflates the numbers: each day is credited
 * with its own gain over the previous recorded value.
 */
export function computeDailyUsage(state: StudyState): Map<string, DailyUsage> {
  const usage = new Map<string, DailyUsage>()
  const entry = (day: string): DailyUsage => {
    let value = usage.get(day)
    if (!value) {
      value = { words: 0, feedSeconds: 0 }
      usage.set(day, value)
    }
    return value
  }

  for (const [day, stat] of Object.entries(state.dailyStat)) {
    entry(day).feedSeconds += stat.feedSeconds
  }

  const bucketsByDay = new Map<string, Map<string, number>>()
  for (const [day, perBucket] of Object.entries(state.dailyPointers)) {
    for (const [bucketId, gp] of Object.entries(perBucket)) {
      let bucketGps = bucketsByDay.get(bucketId)
      if (!bucketGps) {
        bucketGps = new Map()
        bucketsByDay.set(bucketId, bucketGps)
      }
      bucketGps.set(day, gp)
    }
  }
  for (const bucketGps of bucketsByDay.values()) {
    const days = [...bucketGps.keys()].sort()
    let previous = 0
    for (const day of days) {
      const gp = bucketGps.get(day)!
      entry(day).words += Math.max(0, gp - previous)
      previous = gp
    }
  }
  return usage
}

/**
 * What was fed of one bucket, day by day: each day's high-water gain over the
 * previous one, expressed as round + inclusive position range. Ranges crossing
 * a round boundary are split so every entry stays within one round.
 */
export function dailyFeedRanges(
  state: StudyState,
  params: { bucketId: string; wordCount: number },
): DailyFeedRange[] {
  const { bucketId, wordCount } = params
  const perBucket: [string, number][] = Object.entries(state.dailyPointers)
    .filter(([, perBucket]) => perBucket[bucketId] !== undefined)
    .map(([day, perBucket]) => [day, perBucket[bucketId]] as [string, number])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))

  const ranges: DailyFeedRange[] = []
  let previous = 0
  for (const [day, gp] of perBucket) {
    let cursor = previous + 1
    while (cursor <= gp) {
      const { round, position } = splitGlobalPosition(cursor, wordCount)
      const roundEndGp = round * wordCount
      const toGp = Math.min(gp, roundEndGp)
      ranges.push({ day, round, from: position, to: toGp - (round - 1) * wordCount })
      cursor = toGp + 1
    }
    previous = gp
  }
  return ranges
}
