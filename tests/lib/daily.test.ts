import { aggregateMonths, computeDailyUsage } from '@/lib/daily'

describe('computeDailyUsage', () => {
  it('sums time per day and derives word counts from pointer deltas', () => {
    const usage = computeDailyUsage(
      [
        { day: '2026-10-26', feedSeconds: 60, appSeconds: 120 },
        { day: '2026-10-27', feedSeconds: 30, appSeconds: 90 },
      ],
      [
        // 2050 walks 10 words on the 26th and 5 on the 27th.
        { day: '2026-10-26', bucketName: '2050', globalPosition: 10 },
        { day: '2026-10-27', bucketName: '2050', globalPosition: 15 },
        // 370 starts on the 27th; its first snapshot credits the full gain.
        { day: '2026-10-27', bucketName: '370', globalPosition: 3 },
      ],
    )

    expect(usage.get('2026-10-26')).toEqual({ words: 10, feedSeconds: 60, appSeconds: 120 })
    expect(usage.get('2026-10-27')).toEqual({ words: 8, feedSeconds: 30, appSeconds: 90 })
  })

  it('never counts a lower snapshot as negative', () => {
    const usage = computeDailyUsage(
      [],
      [
        { day: '2026-10-26', bucketName: '2050', globalPosition: 100 },
        { day: '2026-10-27', bucketName: '2050', globalPosition: 40 },
      ],
    )
    expect(usage.get('2026-10-27')?.words).toBe(0)
  })
})

describe('aggregateMonths', () => {
  it('folds days into month sums, newest first', () => {
    const months = aggregateMonths(
      new Map([
        ['2026-11-01', { words: 30, feedSeconds: 600, appSeconds: 900 }],
        ['2026-11-02', { words: 12, feedSeconds: 300, appSeconds: 600 }],
        ['2025-12-24', { words: 8, feedSeconds: 120, appSeconds: 240 }],
      ]),
    )

    expect(months.map((month) => month.key)).toEqual(['2026-11', '2025-12'])
    expect(months[0]).toEqual({
      key: '2026-11',
      label: 'Nov 2026',
      words: 42,
      feedSeconds: 900,
      appSeconds: 1500,
      activeDays: 2,
    })
  })

  it('keeps a time-only month but grants it no active days', () => {
    const months = aggregateMonths(
      new Map([['2026-10-31', { words: 0, feedSeconds: 120, appSeconds: 240 }]]),
    )
    expect(months).toHaveLength(1)
    expect(months[0]).toMatchObject({ words: 0, feedSeconds: 120, activeDays: 0 })
  })

  it('is empty when no day has any usage', () => {
    expect(aggregateMonths(new Map())).toEqual([])
  })
})
