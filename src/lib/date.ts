/** Local-timezone calendar date as YYYY-MM-DD. */
export function todayLocalDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local-timezone epoch bounds of a YYYY-MM-DD day. */
export function dayBounds(day: string): { start: number; end: number } {
  const [year, month, date] = day.split('-').map(Number);
  const start = new Date(year, month - 1, date).getTime();
  return { start, end: start + 86_400_000 };
}

/**
 * Number of calendar days spanned between two timestamps, inclusive of both the start and end day.
 * e.g. same day = 1d, next day = 2d.
 */
export function calendarDaysBetween(startTs: number, endTs: number): number {
  if (startTs <= 0 || endTs <= 0) return 1;
  const startDay = todayLocalDate(new Date(startTs));
  const endDay = todayLocalDate(new Date(endTs));
  const startMidnight = dayBounds(startDay).start;
  const endMidnight = dayBounds(endDay).start;
  const diffDays = Math.round((endMidnight - startMidnight) / 86_400_000);
  return Math.max(1, diffDays + 1);
}
