import { calendarDaysBetween, dayBounds, todayLocalDate } from '@/lib/date'

describe('todayLocalDate', () => {
  it('formats a local calendar date', () => {
    expect(todayLocalDate(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07')
    expect(todayLocalDate(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('dayBounds', () => {
  it('returns local midnight to midnight', () => {
    const { start, end } = dayBounds('2026-10-07')
    expect(start).toBe(new Date(2026, 9, 7).getTime())
    expect(end - start).toBe(86_400_000)
  })
})

describe('calendarDaysBetween', () => {
  it('counts both endpoints, so same day is 1d', () => {
    const start = new Date(2026, 9, 7, 8, 31).getTime()
    expect(calendarDaysBetween(start, start)).toBe(1)
    expect(calendarDaysBetween(start, new Date(2026, 9, 7, 23).getTime())).toBe(1)
    expect(calendarDaysBetween(start, new Date(2026, 9, 8, 8).getTime())).toBe(2)
    expect(calendarDaysBetween(start, new Date(2026, 9, 17, 9).getTime())).toBe(11)
  })

  it('falls back to 1d for missing timestamps', () => {
    expect(calendarDaysBetween(0, 123)).toBe(1)
    expect(calendarDaysBetween(123, 0)).toBe(1)
  })
})
