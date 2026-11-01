import { act, create, type ReactTestRenderer } from 'react-test-renderer'

jest.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
jest.mock('expo-router', () => ({
  // Focus effects run once on mount, like the real hook's focus phase.
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = require('react')
    useEffect(callback, [])
  },
  router: { push: jest.fn(), back: jest.fn() },
}))
jest.mock('@/db/index', () => require('../db/harness').dbIndex())

import type { WordWithFlag } from '@/db/repo'
import type { StudySession } from '@/study/session'
import type { StudyMode } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { getDb } from '@/db/index'
import { getProgress, getWordsWithRoundFlag, settleCard } from '@/db/repo'
import { seedBuckets } from '@/db/seed'
import { useStudySession } from '@/study/use-study-session'

const BUCKET = '2050'

// A minimal mode with the gated-answer profile (like quiz) and a prepare
// side effect the tests can observe.
let prepared = 0
const testMode: StudyMode = {
  id: 'choice',
  label: 'Quiz',
  speakOnSettle: false,
  scrubbable: true,
  scrollable: false,
  autoAdvanceMs: 650,
  autoFlagOnWrong: true,
  prepare: (words) => {
    prepared += 1
    void words
  },
  renderCard: () => null,
  endCopy: ({ nextRound }) => ({ title: 'Round complete', subtitle: `r${nextRound}` }),
}

/**
 * Behavioral checklist — every item maps to a pre-refactor screen behavior
 * that regressed once already:
 *   load            → progress + flag-joined words + prepare()
 *   answer wrong    → answer recorded, word auto-flagged, flag written to db
 *   answer correct  → answer recorded, auto-advance scheduled, no flag write
 *   settle          → probe advances in state AND in the db
 *   settle browsing → probe untouched
 *   skip/draft      → session-local
 *   reachEnd        → veto while browsing/behind; completes + reloads round
 */
async function seed(): Promise<void> {
  const db = await getDb()
  await seedBuckets(db, require('../db/harness').dbIndex().withTransaction)
}

beforeEach(async () => {
  require('../db/harness').resetDb()
  await seed()
  prepared = 0
})

describe('useStudySession wiring', () => {
  let renderer: ReactTestRenderer
  let latest: { session: StudySession; actions: ReturnType<typeof useStudySession>['actions'] }

  const words = () => (latest.session.status === 'ready' ? latest.session.words : [])
  const wordAt = (ordinal: number): DeckWord => words()[ordinal]

  beforeEach(async () => {
    function Probe() {
      const value = useStudySession(BUCKET, testMode)
      latest = value
      return null
    }
    await act(async () => {
      renderer = create(<Probe />)
    })
  })

  afterEach(() => {
    renderer.unmount()
  })

  it('loads words, progress and runs prepare once per load', async () => {
    expect(latest.session.status).toBe('ready')
    expect(words().length).toBeGreaterThan(0)
    expect(prepared).toBe(1)
  })

  it('a wrong answer records, auto-flags and writes the db flag', async () => {
    const target = wordAt(1)
    await act(async () => {
      latest.actions.answer(target, false, 'd1')
    })
    const session = latest.session as Extract<StudySession, { status: 'ready' }>
    expect(session.answers[target.position]).toMatchObject({ correct: false, picked: 'd1' })
    expect(words().find((w) => w.position === target.position)?.flagged).toBe(true)
    const dbWord = (await getWordsWithRoundFlag(BUCKET, session.progress.round)).find(
      (w) => w.position === target.position,
    )
    expect(dbWord?.flagged).toBe(true)
  })

  it('a correct answer schedules the auto-advance without flagging', async () => {
    const target = wordAt(0)
    await act(async () => {
      latest.actions.answer(target, true)
    })
    const session = latest.session as Extract<StudySession, { status: 'ready' }>
    expect(session.answers[target.position]).toMatchObject({ correct: true })
    expect(session.pendingAutoAdvance).toMatchObject({ position: target.position })
    expect(words().find((w) => w.position === target.position)?.flagged).toBe(false)
  })

  it('settling advances the probe in state and in the database', async () => {
    const target = wordAt(1)
    await act(async () => {
      latest.actions.answer(target, false, undefined) // unlock the gate
      latest.actions.settle(1)
    })
    expect(latest.session.status === 'ready' && latest.session.progress.pointer).toBe(1)
    expect((await getProgress(BUCKET)).pointer).toBe(1)
  })

  it('browsing settles do not move the probe', async () => {
    await act(async () => {
      latest.actions.startBrowsing()
    })
    // A separate act: in the app these are separate gestures/renders.
    await act(async () => {
      latest.actions.settle(2)
    })
    expect((await getProgress(BUCKET)).pointer).toBe(0)
    expect(latest.session.status === 'ready' && latest.session.progress.pointer).toBe(0)
  })

  it('reachEnd is vetoed while browsing and behind the frontier', async () => {
    await act(async () => {
      latest.actions.startBrowsing()
    })
    expect(latest.actions.reachEnd()).toBe(false)
  })

  it('reachEnd completes the round and reloads the carried words', async () => {
    const wordCount = words().length
    // Walk the whole round: answer card 0, then settle up to the end.
    const first = wordAt(0)
    await act(async () => {
      latest.actions.answer(first, true) // unlocks the gate
    })
    for (let index = 1; index < wordCount; index++) {
      await act(async () => {
        latest.actions.settle(index)
      })
    }
    // Landing on the end page (deck settle → onReached → reachEnd).
    await act(async () => {
      expect(latest.actions.reachEnd()).toBe(true)
    })
    // The reducer entered the next round...
    expect(latest.session.status === 'ready' && latest.session.progress.round).toBe(2)
    // ...and the db round advanced too.
    expect((await getProgress(BUCKET)).round).toBe(2)
    // prepare ran again for the carried word list.
    expect(prepared).toBeGreaterThanOrEqual(2)
  })
})
