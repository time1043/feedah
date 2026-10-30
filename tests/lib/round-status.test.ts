import { roundStatuses } from '@/lib/round-status'

describe('roundStatuses', () => {
  it('red wins over green; swept cards are green; unswept cards stay gray', () => {
    // Flags are card ordinals: cards 1 and 3 are flagged, the pointer swept
    // cards 0..3.
    const statuses = roundStatuses(10, { done: false, pointer: 4, flags: [1, 3] })
    expect(statuses).toEqual([
      'green',
      'red',
      'green',
      'red',
      'gray',
      'gray',
      'gray',
      'gray',
      'gray',
      'gray',
    ])
  })

  it('a done round is green everywhere except the flags', () => {
    const statuses = roundStatuses(5, { done: true, pointer: 5, flags: [2] })
    expect(statuses).toEqual(['green', 'green', 'red', 'green', 'green'])
  })

  it('a fresh round shows flags red and everything else gray', () => {
    expect(roundStatuses(4, { done: false, pointer: 0, flags: [1, 3] })).toEqual([
      'gray',
      'red',
      'gray',
      'red',
    ])
  })
})
