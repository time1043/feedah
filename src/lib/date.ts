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
