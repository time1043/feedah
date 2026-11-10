import { formatSpan, formatStamp } from '@/lib/round-time'

/** Local-time construction keeps these cases timezone-independent: Nov of
 * 2026 unless a case says otherwise. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime()
const atDate = (year: number, month: number, day: number, hour: number) =>
  new Date(year, month, day, hour).getTime()

describe('formatStamp', () => {
  it('drops the date for a stamp from today', () => {
    expect(formatStamp(at(10, 14, 5), at(10, 18))).toBe('14:05')
  })

  it('keeps the date but drops the year for another day of this year', () => {
    expect(formatStamp(at(10, 14, 5), at(12, 9))).toBe('Nov 10, 14:05')
  })

  it('carries the year once the stamp is from another one', () => {
    // Nov 10 2025, read one year later.
    expect(formatStamp(atDate(2025, 10, 10, 14), at(10, 18))).toBe('Nov 10, 2025, 14:00')
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

  it('keeps the hours right up to the last one before a day', () => {
    expect(formatSpan(at(10, 14), at(11, 13, 30))).toBe('23h 30m')
  })

  it('stops at the day count once a span passes a day', () => {
    // 24h exactly is one day, and 29h is still "1d" — no hours below it.
    expect(formatSpan(at(10, 14), at(11, 14))).toBe('1d')
    expect(formatSpan(at(10, 14), at(11, 19))).toBe('1d')
    // 6 days 19 hours.
    expect(formatSpan(at(10, 14), at(17, 9))).toBe('6d')
  })

  it('reads an unstamped start or a backwards span as unknown', () => {
    expect(formatSpan(0, at(10, 14))).toBe('—')
    expect(formatSpan(at(10, 14), at(10, 14) - 1000)).toBe('—')
  })
})
