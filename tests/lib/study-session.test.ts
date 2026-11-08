import type { DeckWord } from '@/types/bucket'

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
  const words: DeckWord[] = BUCKET_POSITIONS.map((position, i) => ({
    position,
    word: `w${i}`,
    ipa: '',
    meaning: `m${i}`,
    forms: [],
    distractors: [],
    flagged: false,
  }))
  const base: ReadySession = {
    status: 'ready',
    words,
    progress: { round: 1, pointer: 0, roundStartedAt: 0 },
    browsing: false,
    answers: {},
    drafts: {},
    pendingAutoAdvance: null,
    endFacts: null,
  }
  return { ...base, ...overrides }
}

function reduce(session: ReadySession, action: StudyAction): ReadySession {
  // A ready session stays ready under every action (the reducer's guards
  // pass it through), so the cast is honest.
  return studyReducer(session, action) as ReadySession
}

describe('studyReducer', () => {
  it('starts a loaded session at the given probe', () => {
    const s = studyReducer(LOADING(), {
      type: 'loaded',
      words: readySession().words,
      progress: { round: 2, pointer: 3, roundStartedAt: 9 },
    })
    expect(s.status).toBe('ready')
    if (s.status !== 'ready') return
    expect(s.progress).toEqual({ round: 2, pointer: 3, roundStartedAt: 9 })
    expect(s.browsing).toBe(false)
    expect(s.answers).toEqual({})
  })

  it('settled advances the pointer monotonically', () => {
    let s = readySession()
    s = reduce(s, { type: 'settled', index: 2 })
    expect(s.progress.pointer).toBe(2)
    // Re-settling behind the frontier changes nothing.
    s = reduce(s, { type: 'settled', index: 1 })
    expect(s.progress.pointer).toBe(2)
  })

  it('browse-mode settles never move the pointer', () => {
    let s = reduce(readySession(), { type: 'settled', index: 1 })
    s = reduce(s, { type: 'browsingStarted' })
    s = reduce(s, { type: 'settled', index: 4 })
    expect(s.browsing).toBe(true)
    expect(s.progress.pointer).toBe(1)
  })

  it('resume leaves the pointer where the probe was', () => {
    let s = reduce(readySession(), { type: 'browsingStarted' })
    s = reduce(s, { type: 'resumed' })
    expect(s.browsing).toBe(false)
    expect(s.progress.pointer).toBe(0)
  })

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
      autoAdvanceDueAt: null,
    })
    expect(s.answers[1703]).toEqual({ correct: true, picked: undefined })
    expect(s.words.find((w) => w.position === 1703)?.flagged).toBe(false)
  })

  it('answered schedules an auto-advance only for correct picks', () => {
    let s = reduce(readySession(), {
      type: 'answered',
      position: 1702,
      correct: false,
      autoFlag: false,
      autoAdvanceDueAt: 1000,
    })
    expect(s.pendingAutoAdvance).toBeNull()
    s = reduce(s, {
      type: 'answered',
      position: 1703,
      correct: true,
      autoFlag: false,
      autoAdvanceDueAt: 1000,
    })
    expect(s.pendingAutoAdvance).toEqual({ position: 1703, dueAt: 1000 })
  })

  it('skipped and drafted record per-card state', () => {
    let s = reduce(readySession(), { type: 'skipped', position: 1702 })
    expect(s.answers[1702]).toEqual({ skipped: true })
    s = reduce(s, { type: 'drafted', position: 1703, value: 'hellos' })
    expect(s.drafts[1703]).toBe('hellos')
  })

  it('flagToggled flips the word and survives a round advance', () => {
    let s = reduce(readySession(), { type: 'flagToggled', position: 1702 })
    expect(s.words.find((w) => w.position === 1702)?.flagged).toBe(true)
    s = reduce(s, { type: 'roundAdvanced', now: 5, answered: 0, correct: 0 })
    expect(s.progress.round).toBe(2)
    expect(s.progress.pointer).toBe(0)
    // The flags ride into the next round (the db carries them too later).
    expect(s.words.find((w) => w.position === 1702)?.flagged).toBe(true)
  })

  it('roundAdvanced freezes the tallies into endFacts', () => {
    let s = reduce(readySession(), {
      type: 'answered',
      position: 1701,
      correct: true,
      autoFlag: false,
      autoAdvanceDueAt: null,
    })
    s = reduce(s, {
      type: 'answered',
      position: 1702,
      correct: false,
      autoFlag: false,
      autoAdvanceDueAt: null,
    })
    s = reduce(s, { type: 'roundAdvanced', now: 5, answered: 2, correct: 1 })
    expect(s.endFacts).toEqual({ answered: 2, correct: 1, nextRound: 2 })
  })

  it('countsOf and frontierOf read through the ready session', () => {
    let s = reduce(readySession(), {
      type: 'answered',
      position: 1701,
      correct: true,
      autoFlag: false,
      autoAdvanceDueAt: null,
    })
    s = reduce(s, { type: 'skipped', position: 1702 })
    expect(countsOf(s)).toEqual({ answered: 1, correct: 1 })
    expect(frontierOf(s)).toBe(0)
    s = reduce(s, { type: 'settled', index: 3 })
    expect(frontierOf(s)).toBe(3)
    expect(frontierOf({ status: 'loading' })).toBe(0)
  })

  it('guards against actions on a loading session', () => {
    const s = studyReducer({ status: 'loading' }, { type: 'browsingStarted' })
    expect(s).toEqual({ status: 'loading' })
  })
})

function LOADING(): StudySession {
  return { status: 'loading' }
}
