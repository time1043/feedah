import { formatSpan, formatStamp } from '@/lib/round-time'

// Local-time construction keeps these cases timezone-independent.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime()

describe('formatStamp', () => {
  it('drops the date for a stamp from today', () => {
    expect(formatStamp(at(10, 14, 5), at(10, 18))).toBe('14:05')
  })

  it('keeps the date for another day', () => {
    expect(formatStamp(at(10, 14, 5), at(12, 9))).toBe('Nov 10, 14:05')
  })

  it('reads an unrecorded stamp as unknown', () => {
    expect(formatStamp(0, at(10, 18))).toBe('—')
  })
})

describe('formatSpan', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatSpan(at(10, 14), at(10, 14) + 38_000)).toBe('38s')
    expect(formatSpan(at(10, 14), at(10, 14) + 392_000)).toBe('6m 32s')
    expect(formatSpan(at(10, 14), at(10, 14) + 3_900_000)).toBe('1h 5m')
  })

  it('reads an unstamped start or a backwards span as unknown', () => {
    expect(formatSpan(0, at(10, 14))).toBe('—')
    expect(formatSpan(at(10, 14), at(10, 14) - 1000)).toBe('—')
  })
})
