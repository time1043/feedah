import { roundStatuses } from '@/lib/round-status'

describe('roundStatuses', () => {
  it('paints the reached cards green and the rest gray', () => {
    expect(roundStatuses(4, { swept: 2, flags: [] })).toEqual(['green', 'green', 'gray', 'gray'])
  })

  it('a finished round is green end to end', () => {
    expect(roundStatuses(3, { swept: 3, flags: [] })).toEqual(['green', 'green', 'green'])
  })

  it('a round that has not been entered is all gray', () => {
    expect(roundStatuses(3, { swept: 0, flags: [] })).toEqual(['gray', 'gray', 'gray'])
  })

  it('a swept count past the list still paints every card green', () => {
    expect(roundStatuses(2, { swept: 9, flags: [] })).toEqual(['green', 'green'])
  })

  it('red wins over green, and unswept flags stay red over gray', () => {
    // Cards 1 and 3 are flagged, the walk reached cards 0..3.
    expect(roundStatuses(10, { swept: 4, flags: [1, 3] })).toEqual([
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

  it('a finished round is green everywhere except the flags', () => {
    expect(roundStatuses(5, { swept: 5, flags: [2] })).toEqual([
      'green',
      'green',
      'red',
      'green',
      'green',
    ])
  })

  it('a fresh round shows its flags red and everything else gray', () => {
    expect(roundStatuses(4, { swept: 0, flags: [1, 3] })).toEqual(['gray', 'red', 'gray', 'red'])
  })
})
