import { calendarDaysBetween, dayBounds, todayLocalDate } from '@/lib/date'
import { formatDayLabel, formatMinutes, formatYearMonthDay } from '@/lib/format'

// TZ is pinned to UTC in jest.config.js.
const OCT_7_2026 = Date.UTC(2026, 9, 7, 14, 30)
const OCT_17_2026 = Date.UTC(2026, 9, 17, 9, 0)

describe('todayLocalDate', () => {
  it('formats a timestamp as its local YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date(OCT_7_2026))).toBe('2026-10-07')
  })
})

describe('dayBounds', () => {
  it('returns the local midnight bounds of a day', () => {
    const { start, end } = dayBounds('2026-10-07')
    expect(start).toBe(Date.UTC(2026, 9, 7))
    expect(end - start).toBe(86_400_000)
  })
})

describe('calendarDaysBetween', () => {
  it('counts calendar days inclusively', () => {
    expect(calendarDaysBetween(OCT_7_2026, OCT_7_2026)).toBe(1)
    expect(calendarDaysBetween(OCT_7_2026, OCT_17_2026)).toBe(11)
  })

  it('falls back to 1 for missing timestamps', () => {
    expect(calendarDaysBetween(0, OCT_17_2026)).toBe(1)
  })
})

describe('formatMinutes', () => {
  it('formats seconds as minutes and hours', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(47 * 60)).toBe('47m')
    expect(formatMinutes(72 * 60)).toBe('1h 12m')
  })
})

describe('formatYearMonthDay', () => {
  it('formats days and timestamps as "2026 Oct 7"', () => {
    expect(formatYearMonthDay('2026-10-07')).toBe('2026 Oct 7')
    expect(formatYearMonthDay(OCT_7_2026)).toBe('2026 Oct 7')
    expect(formatYearMonthDay('not-a-day')).toBe('not-a-day')
  })
})

describe('formatDayLabel', () => {
  it('formats a day as "Wed, Oct 7"', () => {
    expect(formatDayLabel('2026-10-07')).toBe('Wed, Oct 7')
  })
})
