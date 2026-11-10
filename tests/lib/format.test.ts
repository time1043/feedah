import {
  formatDayLabel,
  formatMinutes,
  formatMonthLabel,
  formatMonthShort,
  formatThousands,
  formatYearMonthDay,
} from '@/lib/format'

describe('formatMinutes', () => {
  it('formats below and above one hour', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(47 * 60)).toBe('47m')
    expect(formatMinutes(63 * 60)).toBe('1h 3m')
  })
})

describe('formatDayLabel', () => {
  it('formats a weekday label', () => {
    expect(formatDayLabel('2026-10-26')).toBe('Mon, Oct 26')
  })
})

describe('formatYearMonthDay', () => {
  it('accepts a day string or a timestamp', () => {
    expect(formatYearMonthDay('2026-10-07')).toBe('2026 Oct 7')
    expect(formatYearMonthDay(new Date(2026, 9, 7).getTime())).toBe('2026 Oct 7')
  })
})

describe('formatMonthLabel', () => {
  it('formats a month key', () => {
    expect(formatMonthLabel('2026-11')).toBe('Nov 2026')
    expect(formatMonthLabel('garbled')).toBe('garbled')
  })
})

describe('formatThousands', () => {
  it('groups digits with commas', () => {
    expect(formatThousands(2800)).toBe('2,800')
    expect(formatThousands(160)).toBe('160')
    expect(formatThousands(0)).toBe('0')
  })
})

describe('formatMonthShort', () => {
  it('formats the bare month name and falls back to the raw key', () => {
    expect(formatMonthShort('2026-11')).toBe('Nov')
    expect(formatMonthShort('garbled')).toBe('garbled')
  })
})
