import { roundStatuses } from '@/lib/round-status'

describe('roundStatuses', () => {
  it('red wins over green; swept words are green; unswept words stay gray', () => {
    const statuses = roundStatuses(10, { done: false, pointer: 4, flags: [2, 4] })
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
    const statuses = roundStatuses(5, { done: true, pointer: 5, flags: [3] })
    expect(statuses).toEqual(['green', 'green', 'red', 'green', 'green'])
  })

  it('a fresh round shows flags red and everything else gray', () => {
    expect(roundStatuses(4, { done: false, pointer: 0, flags: [2, 4] })).toEqual([
      'gray',
      'red',
      'gray',
      'red',
    ])
  })
})
