import { roundStatuses } from '@/lib/round-status'

describe('roundStatuses', () => {
  it('paints the reached cards green and the rest gray', () => {
    expect(roundStatuses(4, 2)).toEqual(['green', 'green', 'gray', 'gray'])
  })

  it('a finished round is green end to end', () => {
    expect(roundStatuses(3, 3)).toEqual(['green', 'green', 'green'])
  })

  it('a round that has not been entered is all gray', () => {
    expect(roundStatuses(3, 0)).toEqual(['gray', 'gray', 'gray'])
  })

  it('a swept count past the list still paints every card green', () => {
    expect(roundStatuses(2, 9)).toEqual(['green', 'green'])
  })
})
