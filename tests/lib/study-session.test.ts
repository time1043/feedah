import type { Progress, WordWithFlag } from '@/db/repo'

import {
  countsOf,
  frontierOf,
  studyReducer,
  type StudyAction,
  type StudySession,
} from '@/lib/study-session'

const BUCKET_POSITIONS = [1701, 1702, 1703, 1704, 1705]

type ReadySession = Extract<StudySession, { status: 'ready' }>

function readySession(overrides: Partial<ReadySession> = {}): ReadySession {
  const words: WordWithFlag[] = BUCKET_POSITIONS.map((position, i) => ({
    position,
    word: `w${i}`,
    ipa: '',
    meaning: `m${i}`,
    forms: [],
    distractors: [],
    flagged: false,
  }))
  const progress: Progress = { round: 1, pointer: 0, roundStartedAt: 0 }
  const base: Extract<StudySession, { status: 'ready' }> = {
    status: 'ready',
    words,
    progress,
    browsing: false,
    answers: {},
    drafts: {},
    pendingAutoAdvance: null,
  }
  return { ...base, ...overrides }
}

function reduce(session: ReadySession, action: StudyAction): ReadySession {
  // A ready session stays ready under every action (the reducer's guards
  // pass it through), so the cast is honest.
  return studyReducer(session, action) as ReadySession
}

describe('studyReducer', () => {
  it('answered writes the answer and auto-flags only on wrong picks', () => {
    let s = readySession()
    s = reduce(s, {
      type: 'answered',
      position: 1702,
      correct: false,
      picked: 'd1',
      autoFlag: true,
      autoAdvanceDueAt: null,
    })
    expect(s.answers[1702]).toEqual({ correct: false, picked: 'd1' })
    expect(s.words.find((w) => w.position === 1702)?.flagged).toBe(true)

    s = reduce(s, {
      type: 'answered',
      position: 1703,
      correct: true,
      autoFlag: true,
      autoAdvanceDueAt: 123,
    })
    expect(s.answers[1703]).toEqual({ correct: true, picked: undefined })
    expect(s.words.find((w) => w.position === 1703)?.flagged).toBe(false)
  })

  it('settled advances the pointer monotonically and never while browsing', () => {
    let s = readySession()
    s = reduce(s, { type: 'settled', index: 2 })
    s = reduce(s, { type: 'settled', index: 1 })
    expect(s.progress.pointer).toBe(2)

    s = reduce(s, { type: 'browsingStarted' })
    s = reduce(s, { type: 'settled', index: 4 })
    expect(s.progress.pointer).toBe(2)
    expect(s.browsing).toBe(true)
  })

  it('resumed exits browsing; roundAdvanced resets the session part', () => {
    let s = readySession({ browsing: true, answers: { 1702: { correct: false } } })
    s = reduce(s, { type: 'resumed' })
    expect(s.browsing).toBe(false)

    s = reduce(s, { type: 'roundAdvanced', now: 123 })
    expect(s.progress).toMatchObject({ round: 2, pointer: 0, roundStartedAt: 123 })
    expect(s.answers).toEqual({})
    expect(s.browsing).toBe(false)
  })

  it('flagToggled flips the word; drafted writes the draft', () => {
    let s = readySession()
    s = reduce(s, { type: 'flagToggled', position: 1703 })
    expect(s.words.find((w) => w.position === 1703)?.flagged).toBe(true)
    s = reduce(s, { type: 'drafted', position: 1703, value: 'ki' })
    expect(s.drafts[1703]).toBe('ki')
  })

  it('loaded restarts the session', () => {
    let s = readySession({ browsing: true, answers: { 1702: { correct: true } } })
    s = reduce(s, { type: 'loaded', words: s.words, progress: s.progress })
    expect(s).toMatchObject({ status: 'ready', browsing: false, answers: {} })
  })
})

describe('selectors', () => {
  it('frontierOf clamps the pointer to the word count', () => {
    const s = readySession({ progress: { round: 2, pointer: 99, roundStartedAt: 1 } })
    expect(frontierOf(s)).toBe(5)
  })

  it('countsOf skips skipped answers', () => {
    const s = readySession({
      answers: {
        1701: { correct: true },
        1702: { correct: false },
        1703: { skipped: true },
      },
    })
    expect(countsOf(s)).toEqual({ answered: 2, correct: 1 })
  })
})
