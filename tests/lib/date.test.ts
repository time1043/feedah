import { calendarDaysBetween, dayBounds, todayLocalDate } from '@/lib/date';

const DAY_MS = 86_400_000;

describe('todayLocalDate', () => {
  it('formats a local date as zero-padded YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(todayLocalDate(new Date(2026, 8, 3))).toBe('2026-09-03');
  });

  it('uses the calendar day — a late-night time stays on its local day', () => {
    expect(todayLocalDate(new Date(2026, 9, 26, 23, 59, 59))).toBe('2026-10-26');
    expect(todayLocalDate(new Date(2026, 9, 26, 0, 0, 0))).toBe('2026-10-26');
  });
});

describe('dayBounds', () => {
  it('spans exactly one day from local midnight', () => {
    const start = new Date(2026, 9, 26).getTime();
    expect(dayBounds('2026-10-26')).toEqual({ start, end: start + DAY_MS });
  });
});

describe('calendarDaysBetween', () => {
  it('counts the same day as one day regardless of clock time', () => {
    const start = new Date(2026, 9, 26, 8).getTime();
    const end = new Date(2026, 9, 26, 23).getTime();
    expect(calendarDaysBetween(start, end)).toBe(1);
  });

  it('counts crossing midnight as two days', () => {
    const start = new Date(2026, 9, 26, 23, 59).getTime();
    const end = new Date(2026, 9, 27, 0, 1).getTime();
    expect(calendarDaysBetween(start, end)).toBe(2);
  });

  it('counts both endpoints of a longer span', () => {
    const start = new Date(2026, 9, 1).getTime();
    const end = new Date(2026, 9, 31).getTime();
    expect(calendarDaysBetween(start, end)).toBe(31);
  });

  it('spans month and year boundaries', () => {
    const start = new Date(2025, 11, 31, 12).getTime();
    const end = new Date(2026, 0, 1, 12).getTime();
    expect(calendarDaysBetween(start, end)).toBe(2);
  });

  it('treats non-positive timestamps defensively as one day', () => {
    expect(calendarDaysBetween(0, 123)).toBe(1);
    expect(calendarDaysBetween(-5, 100)).toBe(1);
  });
});
