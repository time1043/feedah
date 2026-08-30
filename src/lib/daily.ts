import type { DailyPointerRow, DailyStatRow } from '@/db/repo';

export type DailyUsage = {
  words: number;
  feedSeconds: number;
  appSeconds: number;
};

/**
 * Aggregates daily activity. Word counts come from the difference of
 * consecutive daily high-water pointer snapshots (never from per-card
 * events), so re-viewing earlier cards never inflates the numbers.
 * A pointer row holds the end-of-day value; each row's gain over the
 * previous recorded value is credited to its own day.
 */
export function computeDailyUsage(
  stats: DailyStatRow[],
  pointers: DailyPointerRow[],
): Map<string, DailyUsage> {
  const usage = new Map<string, DailyUsage>();
  const entry = (day: string): DailyUsage => {
    let value = usage.get(day);
    if (!value) {
      value = { words: 0, feedSeconds: 0, appSeconds: 0 };
      usage.set(day, value);
    }
    return value;
  };

  for (const stat of stats) {
    const day = entry(stat.day);
    day.feedSeconds += stat.feedSeconds;
    day.appSeconds += stat.appSeconds;
  }

  const byBucket = new Map<string, DailyPointerRow[]>();
  for (const row of pointers) {
    const list = byBucket.get(row.bucketId);
    if (list) {
      list.push(row);
    } else {
      byBucket.set(row.bucketId, [row]);
    }
  }
  for (const rows of byBucket.values()) {
    rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    let previous = 0;
    for (const row of rows) {
      entry(row.day).words += Math.max(0, row.globalPosition - previous);
      previous = row.globalPosition;
    }
  }

  return usage;
}
