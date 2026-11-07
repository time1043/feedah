import { getDrill, getDrills, registerDrill } from '@/drills/registry'

describe('the drill registry', () => {
  it('registers the built-in drills in manifest order', () => {
    expect(getDrills().map((drill) => drill.id)).toEqual(['swipe', 'quiz', 'type'])
  })

  it('looks drills up by id', () => {
    expect(getDrill('quiz').label).toBe('Quiz')
    expect(getDrill('type').label).toBe('Type')
  })

  it('falls back to swipe for unknown ids (legacy stored values)', () => {
    expect(getDrill('nope')).toBe(getDrill('swipe'))
  })

  it('refuses a second drill under the same id', () => {
    expect(() => registerDrill({ ...getDrill('quiz') })).toThrow(/already registered/)
  })
})
