import { formatMonthLabel } from '@/lib/format'

/**
 * Aggregates daily activity. Word counts come from the difference of
 * consecutive daily high-water pointer snapshots (never from per-card
 * events), so re-viewing earlier cards never inflates the numbers. A pointer
 * row holds the end-of-day value; each row's gain over the previous recorded
 * value is credited to its own day.
 */
export type DailyUsage = {
  words: number
  feedSeconds: number
  appSeconds: number
}

export function computeDailyUsage(
  stats: { day: string; feedSeconds: number; appSeconds: number }[],
  pointers: { day: string; bucketId: string; globalPosition: number }[],
): Map<string, DailyUsage> {
  const usage = new Map<string, DailyUsage>()
  const entry = (day: string): DailyUsage => {
    let value = usage.get(day)
    if (!value) {
      value = { words: 0, feedSeconds: 0, appSeconds: 0 }
      usage.set(day, value)
    }
    return value
  }

  for (const stat of stats) {
    const day = entry(stat.day)
    day.feedSeconds += stat.feedSeconds
    day.appSeconds += stat.appSeconds
  }

  const byBucket = new Map<string, { day: string; globalPosition: number }[]>()
  for (const row of pointers) {
    const list = byBucket.get(row.bucketId)
    if (list) {
      list.push(row)
    } else {
      byBucket.set(row.bucketId, [row])
    }
  }
  for (const rows of byBucket.values()) {
    rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    let previous = 0
    for (const row of rows) {
      entry(row.day).words += Math.max(0, row.globalPosition - previous)
      previous = row.globalPosition
    }
  }

  return usage
}

/** One month's ledger folded into a single row. */
export type MonthAggregate = {
  key: string
  label: string
  words: number
  feedSeconds: number
  appSeconds: number
  /** Days that actually moved words — time-only days don't count. */
  activeDays: number
}

/**
 * Folds daily usage into per-month aggregates, newest first. A month exists
 * only when at least one of its days has a recorded row — empty months
 * never appear.
 */
export function aggregateMonths(usage: Map<string, DailyUsage>): MonthAggregate[] {
  const byMonth = new Map<string, MonthAggregate>()
  for (const [day, value] of usage) {
    const key = day.slice(0, 7)
    let month = byMonth.get(key)
    if (!month) {
      month = {
        key,
        label: formatMonthLabel(key),
        words: 0,
        feedSeconds: 0,
        appSeconds: 0,
        activeDays: 0,
      }
      byMonth.set(key, month)
    }
    month.words += value.words
    month.feedSeconds += value.feedSeconds
    month.appSeconds += value.appSeconds
    if (value.words > 0) month.activeDays += 1
  }
  return [...byMonth.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
}
