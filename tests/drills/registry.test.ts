//
// The registry is the core's only contact with concrete drills: manifest
// order, id lookup with the swipe fallback, and duplicate refusal.
//

import { getDrill, getDrills, registerDrill } from '@/drills/registry'

describe('the drill registry', () => {
  it('exposes the manifest order', () => {
    expect(getDrills().map((drill) => drill.id)).toEqual(['swipe', 'quiz', 'type'])
  })

  it('looks drills up by id and falls back to swipe', () => {
    expect(getDrill('quiz').id).toBe('quiz')
    // An unknown id (a legacy stored value) is always safe: swipe records
    // nothing.
    expect(getDrill('nope').id).toBe('swipe')
  })

  it('refuses a second drill under the same id', () => {
    expect(() =>
      registerDrill({
        ...getDrill('swipe'),
        id: 'quiz',
        label: 'Impostor',
      }),
    ).toThrow(/already registered/)
  })
})
