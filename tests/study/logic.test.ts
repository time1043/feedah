import {
  addFeedSeconds,
  completeReviewSession,
  computeDailyUsage,
  currentRound,
  dailyFeedRanges,
  DEFAULT_PROGRESS,
  isRoundComplete,
  nextReviewTime,
  progressOf,
  reviewCursorOf,
  reviewTimesOf,
  roundCounts,
  roundFlagPositions,
  roundRecords,
  roundStatuses,
  saveReviewCursor,
  setRoundFlag,
  settleCard,
  splitGlobalPosition,
} from '@/study/logic'
import { EMPTY_STUDY_STATE } from '@/study/types'

// TZ is pinned to UTC in jest.config.js, so these UTC epochs map to clean days.
const OCT_27_0831 = Date.UTC(2026, 9, 27, 8, 31)
const OCT_27_1034 = Date.UTC(2026, 9, 27, 10, 34)
const OCT_28_0900 = Date.UTC(2026, 9, 28, 9, 0)
const NOV_02_1200 = Date.UTC(2026, 10, 2, 12, 0)

const BUCKET = '2050'
const WORDS = 10

describe('splitGlobalPosition', () => {
  it('decomposes global positions into round and 1-based position', () => {
    expect(splitGlobalPosition(1, 10)).toEqual({ round: 1, position: 1 })
    expect(splitGlobalPosition(10, 10)).toEqual({ round: 1, position: 10 })
    expect(splitGlobalPosition(11, 10)).toEqual({ round: 2, position: 1 })
    expect(splitGlobalPosition(239, 2050)).toEqual({ round: 1, position: 239 })
  })
})

describe('settleCard', () => {
  it('moves the pointer forward one card at a time', () => {
    let state = EMPTY_STUDY_STATE
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 1, at: OCT_27_0831 })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 2, at: OCT_27_1034 })

    expect(progressOf(state, BUCKET)).toEqual({
      round: 1,
      pointer: 2,
      startedAt: OCT_27_0831,
    })
  })

  it('never moves backward and ignores re-settles', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 5,
      at: OCT_27_0831,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 3, at: OCT_27_1034 })

    expect(progressOf(state, BUCKET).pointer).toBe(5)
    // The first settle owns startedAt even after ignored writes.
    expect(progressOf(state, BUCKET).startedAt).toBe(OCT_27_0831)
  })

  it('marks the settled word reached in the current round only', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 3,
      at: OCT_27_0831,
    })

    expect(state.roundWords[BUCKET][1][3]).toEqual({
      reached: true,
      flagged: false,
      reachedAt: OCT_27_0831,
    })
    expect(state.roundWords[BUCKET][2]).toBeUndefined()
  })

  it('keeps the flag when a flagged word is reached', () => {
    let state = setRoundFlag(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      round: 1,
      position: 2,
      flagged: true,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 2, at: OCT_27_0831 })

    expect(state.roundWords[BUCKET][1][2]).toMatchObject({ reached: true, flagged: true })
  })

  it('records the daily high-water snapshot', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 3,
      at: OCT_27_0831,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 7, at: OCT_27_1034 })

    expect(state.dailyPointers['2026-10-27'][BUCKET]).toBe(7)
  })

  it('completes the round at the last word and starts the next one', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS - 1,
      at: OCT_27_0831,
    })
    state = settleCard(state, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_28_0900,
    })

    expect(progressOf(state, BUCKET)).toEqual({ round: 2, pointer: 0, startedAt: OCT_28_0900 })
    expect(state.roundHistory[BUCKET][1]).toEqual({
      startedAt: OCT_27_0831,
      finishedAt: OCT_28_0900,
    })
    expect(isRoundComplete(state, BUCKET, 1, WORDS)).toBe(true)
    // The daily snapshot still points at the end of round 1.
    expect(state.dailyPointers['2026-10-28'][BUCKET]).toBe(WORDS)
  })

  it('keeps buckets independent', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 5,
      at: OCT_27_0831,
    })

    expect(progressOf(state, '700')).toEqual(DEFAULT_PROGRESS)
    expect(currentRound(state, '700')).toBe(1)
  })
})

describe('setRoundFlag', () => {
  it('maintains one independent flag list per round', () => {
    let state = setRoundFlag(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      round: 1,
      position: 1,
      flagged: true,
    })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 2, flagged: true })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 2, position: 1, flagged: true })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 2, position: 3, flagged: true })

    expect(roundFlagPositions(state, BUCKET, 1)).toEqual([1, 2])
    expect(roundFlagPositions(state, BUCKET, 2)).toEqual([1, 3])
    expect(roundFlagPositions(state, BUCKET, 3)).toEqual([])
  })

  it('can flag a word that was never reached', () => {
    const state = setRoundFlag(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      round: 1,
      position: 9,
      flagged: true,
    })

    expect(state.roundWords[BUCKET][1][9]).toEqual({
      reached: false,
      flagged: true,
      reachedAt: 0,
    })
  })

  it('deletes flag-only rows on unflag but keeps green records', () => {
    let state = setRoundFlag(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      round: 1,
      position: 9,
      flagged: true,
    })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 9, flagged: false })
    expect(state.roundWords[BUCKET][1][9]).toBeUndefined()

    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 9, flagged: true })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 9, at: OCT_27_0831 })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 9, flagged: false })

    expect(state.roundWords[BUCKET][1][9]).toMatchObject({ reached: true, flagged: false })
  })

  it('can edit a past round list without touching the current round', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_27_0831,
    })
    expect(progressOf(state, BUCKET).round).toBe(2)

    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 5, flagged: true })

    expect(roundFlagPositions(state, BUCKET, 1)).toEqual([5])
    expect(roundFlagPositions(state, BUCKET, 2)).toEqual([])
  })
})

describe('review sessions and the time counter', () => {
  it('labels sessions with counted sessions + 1', () => {
    expect(nextReviewTime(EMPTY_STUDY_STATE, BUCKET, 1)).toBe(1)

    // A fully fed round: the first completed pass counts, the next runs as time 2.
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_27_0831,
    })
    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 2,
      startedAt: OCT_27_0831,
      finishedAt: OCT_27_1034,
    })
    expect(nextReviewTime(state, BUCKET, 1)).toBe(2)
  })

  it('does not count sessions of a round that has not been fully fed', () => {
    // Only 4 of 10 words fed: every pass is logged but zeroed out.
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 4,
      at: OCT_27_0831,
    })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 2, flagged: true })

    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 1,
      startedAt: OCT_27_0831,
      finishedAt: OCT_27_1034,
    })

    expect(reviewTimesOf(state, BUCKET, 1)).toBe(0)
    expect(state.reviewSessions).toHaveLength(1)
    expect(state.reviewSessions[0]).toMatchObject({
      round: 1,
      time: 1,
      counted: false,
      day: '2026-10-27',
    })

    // A later pass still runs under "time 1" — the earlier ones were discarded.
    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 3,
      startedAt: OCT_27_1034,
      finishedAt: OCT_28_0900,
    })
    expect(reviewTimesOf(state, BUCKET, 1)).toBe(0)
    expect(state.reviewSessions[1]).toMatchObject({ time: 1, counted: false })
  })

  it('counts sessions once the round is fully fed', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_27_0831,
    })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 2, flagged: true })

    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 1,
      startedAt: OCT_27_0831,
      finishedAt: OCT_27_1034,
    })
    expect(reviewTimesOf(state, BUCKET, 1)).toBe(1)

    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 1,
      startedAt: OCT_28_0900,
      finishedAt: NOV_02_1200,
    })
    expect(reviewTimesOf(state, BUCKET, 1)).toBe(2)
    expect(state.reviewSessions[1]).toMatchObject({
      time: 2,
      counted: true,
      day: '2026-11-02',
    })
  })
})

describe('round records', () => {
  it('describes the in-progress round and completed rounds', () => {
    let state = setRoundFlag(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      round: 1,
      position: 2,
      flagged: true,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 3, at: OCT_27_0831 })

    let records = roundRecords(state, { bucketId: BUCKET, wordCount: WORDS, now: OCT_27_1034 })
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      round: 1,
      startedAt: OCT_27_0831,
      finishedAt: null,
      days: 1,
      done: false,
      pointer: 3,
      green: 1,
      red: 1,
    })
    expect(records[0].statuses[1]).toBe('red')
    expect(records[0].statuses[2]).toBe('green')
    expect(records[0].statuses[5]).toBe('gray')

    state = settleCard(state, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_28_0900,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 1, at: OCT_28_0900 })

    records = roundRecords(state, { bucketId: BUCKET, wordCount: WORDS, now: NOV_02_1200 })
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ round: 1, done: true, finishedAt: OCT_28_0900, days: 2 })
    expect(records[1]).toMatchObject({ round: 2, pointer: 1, startedAt: OCT_28_0900 })
  })

  it('shows a not-yet-started round without dates', () => {
    const records = roundRecords(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      now: OCT_27_0831,
    })
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ round: 1, startedAt: 0, days: 0, pointer: 0 })
    expect(roundCounts(EMPTY_STUDY_STATE, BUCKET, 1, WORDS)).toEqual({ green: 0, red: 0 })
  })
})

describe('computeDailyUsage', () => {
  it('credits each day with its watermark gain', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 4,
      at: OCT_27_0831,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 6, at: OCT_28_0900 })
    state = addFeedSeconds(state, { day: '2026-10-27', seconds: 600 })
    state = addFeedSeconds(state, { day: '2026-10-27', seconds: 300 })
    state = addFeedSeconds(state, { day: '2026-10-28', seconds: 1200 })

    const usage = computeDailyUsage(state)
    expect(usage.get('2026-10-27')).toEqual({ words: 4, feedSeconds: 900 })
    expect(usage.get('2026-10-28')).toEqual({ words: 2, feedSeconds: 1200 })
  })

  it('aggregates several buckets and counts a round boundary', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_27_0831,
    })
    // Round 2 starts right away on the same day: gain of 2 more words.
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 2, at: OCT_27_1034 })
    state = settleCard(state, { bucketId: '700', wordCount: 4, position: 1, at: OCT_27_1034 })

    const usage = computeDailyUsage(state)
    // 10 (round 1 complete) + 2 (round 2 start) + 1 (700) — all one day.
    expect(usage.get('2026-10-27')).toEqual({ words: 13, feedSeconds: 0 })
  })
})

describe('dailyFeedRanges', () => {
  it('expresses each day as round + inclusive position range', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 4,
      at: OCT_27_0831,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 7, at: OCT_28_0900 })

    expect(dailyFeedRanges(state, { bucketId: BUCKET, wordCount: WORDS })).toEqual([
      { day: '2026-10-27', round: 1, from: 1, to: 4 },
      { day: '2026-10-28', round: 1, from: 5, to: 7 },
    ])
  })

  it('splits a day that crosses a round boundary', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 9,
      at: OCT_27_0831,
    })
    state = settleCard(state, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_28_0900,
    })
    state = settleCard(state, { bucketId: BUCKET, wordCount: WORDS, position: 2, at: OCT_28_0900 })

    expect(dailyFeedRanges(state, { bucketId: BUCKET, wordCount: WORDS })).toEqual([
      { day: '2026-10-27', round: 1, from: 1, to: 9 },
      { day: '2026-10-28', round: 1, from: 10, to: 10 },
      { day: '2026-10-28', round: 2, from: 1, to: 2 },
    ])
  })

  it('ignores other buckets', () => {
    const state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: '700',
      wordCount: 4,
      position: 2,
      at: OCT_27_0831,
    })
    expect(dailyFeedRanges(state, { bucketId: BUCKET, wordCount: WORDS })).toEqual([])
  })
})

describe('roundStatuses', () => {
  it('ranks red over green', () => {
    let state = settleCard(EMPTY_STUDY_STATE, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: 5,
      at: OCT_27_0831,
    })
    state = setRoundFlag(state, { bucketId: BUCKET, round: 1, position: 3, flagged: true })

    const statuses = roundStatuses(state, BUCKET, 1, WORDS)
    expect(statuses).toHaveLength(WORDS)
    expect(statuses[2]).toBe('red')
    expect(statuses[4]).toBe('green')
    expect(statuses[0]).toBe('gray')
    expect(statuses[9]).toBe('gray')
    expect(roundCounts(state, BUCKET, 1, WORDS)).toEqual({ green: 1, red: 1 })
  })
})

describe('review cursors', () => {
  it('only moves forward and clears on a completed pass', () => {
    let state = saveReviewCursor(EMPTY_STUDY_STATE, { bucketId: BUCKET, round: 1, index: 2 })
    expect(reviewCursorOf(state, BUCKET, 1)).toBe(2)

    state = saveReviewCursor(state, { bucketId: BUCKET, round: 1, index: 1 })
    expect(reviewCursorOf(state, BUCKET, 1)).toBe(2)

    state = settleCard(state, {
      bucketId: BUCKET,
      wordCount: WORDS,
      position: WORDS,
      at: OCT_27_0831,
    })
    state = completeReviewSession(state, {
      bucketId: BUCKET,
      round: 1,
      wordCount: WORDS,
      listSize: 1,
      startedAt: OCT_27_0831,
      finishedAt: OCT_27_1034,
    })
    expect(reviewCursorOf(state, BUCKET, 1)).toBe(0)
  })

  it('keeps cursors per bucket and round', () => {
    let state = saveReviewCursor(EMPTY_STUDY_STATE, { bucketId: BUCKET, round: 1, index: 3 })
    state = saveReviewCursor(state, { bucketId: BUCKET, round: 2, index: 5 })
    state = saveReviewCursor(state, { bucketId: '700', round: 1, index: 1 })

    expect(reviewCursorOf(state, BUCKET, 1)).toBe(3)
    expect(reviewCursorOf(state, BUCKET, 2)).toBe(5)
    expect(reviewCursorOf(state, '700', 1)).toBe(1)
  })
})
