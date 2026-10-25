import { computeDailyUsage } from '@/lib/daily';

import type { DailyPointerRow, DailyStatRow } from '@/db/repo';

const stat = (day: string, feedSeconds: number, appSeconds: number): DailyStatRow => ({
  day,
  feedSeconds,
  appSeconds,
  updatedAt: 0,
});

const pointer = (day: string, bucketId: string, globalPosition: number): DailyPointerRow => ({
  day,
  bucketId,
  globalPosition,
  updatedAt: 0,
});

describe('computeDailyUsage', () => {
  it('returns an empty map for empty input', () => {
    expect(computeDailyUsage([], []).size).toBe(0);
  });

  it('sums stat rows per day', () => {
    const usage = computeDailyUsage(
      [stat('2026-10-25', 100, 10), stat('2026-10-25', 50, 5), stat('2026-10-26', 30, 0)],
      [],
    );
    expect(usage.get('2026-10-25')).toEqual({ words: 0, feedSeconds: 150, appSeconds: 15 });
    expect(usage.get('2026-10-26')).toEqual({ words: 0, feedSeconds: 30, appSeconds: 0 });
  });

  it('credits each pointer row with its gain over the previous day', () => {
    const usage = computeDailyUsage([], [
      pointer('2026-10-25', 'b', 10),
      pointer('2026-10-26', 'b', 25),
    ]);
    expect(usage.get('2026-10-25')!.words).toBe(10);
    expect(usage.get('2026-10-26')!.words).toBe(15);
  });

  it('sorts pointer rows by day regardless of input order', () => {
    const usage = computeDailyUsage([], [
      pointer('2026-10-26', 'b', 25),
      pointer('2026-10-25', 'b', 10),
    ]);
    expect(usage.get('2026-10-25')!.words).toBe(10);
    expect(usage.get('2026-10-26')!.words).toBe(15);
  });

  it('clamps a backwards pointer to zero instead of going negative', () => {
    const usage = computeDailyUsage([], [
      pointer('2026-10-25', 'b', 100),
      pointer('2026-10-26', 'b', 5),
      pointer('2026-10-27', 'b', 7),
    ]);
    expect(usage.get('2026-10-25')!.words).toBe(100);
    expect(usage.get('2026-10-26')!.words).toBe(0);
    // the clamped low value becomes the new baseline
    expect(usage.get('2026-10-27')!.words).toBe(2);
  });

  it('tracks buckets independently', () => {
    const usage = computeDailyUsage([], [
      pointer('2026-10-25', 'a', 10),
      pointer('2026-10-25', 'b', 100),
      pointer('2026-10-26', 'a', 12),
      pointer('2026-10-26', 'b', 101),
    ]);
    expect(usage.get('2026-10-26')!.words).toBe(3);
  });

  it('merges stats and pointer gains into the same day entry', () => {
    const usage = computeDailyUsage([stat('2026-10-25', 60, 0)], [pointer('2026-10-25', 'b', 4)]);
    expect(usage.get('2026-10-25')).toEqual({ words: 4, feedSeconds: 60, appSeconds: 0 });
  });
});
