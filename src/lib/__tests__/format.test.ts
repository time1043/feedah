import { formatClock, formatDayLabel, formatMinutes, formatYearMonthDay } from '@/lib/format';

describe('formatMinutes', () => {
  it('formats sub-hour totals as minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(2820)).toBe('47m');
    expect(formatMinutes(59.9)).toBe('1m');
  });

  it('formats hour+minute totals', () => {
    expect(formatMinutes(4320)).toBe('1h 12m');
    expect(formatMinutes(3600)).toBe('1h 0m');
    // 3599s rounds up to 60 minutes and carries into the hour
    expect(formatMinutes(3599)).toBe('1h 0m');
  });
});

describe('formatClock', () => {
  it('formats h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00:00');
    expect(formatClock(3661)).toBe('1:01:01');
    expect(formatClock(45296)).toBe('12:34:56');
  });

  it('floors and clamps negatives to zero', () => {
    expect(formatClock(-5)).toBe('0:00:00');
    expect(formatClock(59.9)).toBe('0:00:59');
  });
});

describe('formatDayLabel', () => {
  it('renders a weekday-month-day label', () => {
    expect(formatDayLabel('2024-01-01')).toBe('Mon, Jan 1');
    expect(formatDayLabel('2026-10-26')).toBe('Mon, Oct 26');
  });

  it('returns the input unchanged when it is not a real date', () => {
    expect(formatDayLabel('garbage')).toBe('garbage');
    expect(formatDayLabel('0000-00-00')).toBe('0000-00-00');
  });
});

describe('formatYearMonthDay', () => {
  it('formats a YYYY-MM-DD day', () => {
    expect(formatYearMonthDay('2026-10-07')).toBe('2026 Oct 7');
  });

  it('formats a timestamp on the local calendar (UTC under jest)', () => {
    expect(formatYearMonthDay(new Date(2026, 9, 7, 15).getTime())).toBe('2026 Oct 7');
  });

  it('returns invalid strings unchanged', () => {
    expect(formatYearMonthDay('bad')).toBe('bad');
    expect(formatYearMonthDay('2026-10')).toBe('2026-10');
  });
});
