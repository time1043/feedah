import { computeDailyUsage } from '@/lib/daily'

describe('computeDailyUsage', () => {
  it('sums time per day and derives word counts from pointer deltas', () => {
    const usage = computeDailyUsage(
      [
        { day: '2026-10-26', feedSeconds: 60, appSeconds: 120 },
        { day: '2026-10-27', feedSeconds: 30, appSeconds: 90 },
      ],
      [
        // 2050 walks 10 words on the 26th and 5 on the 27th.
        { day: '2026-10-26', bucketId: '2050', globalPosition: 10 },
        { day: '2026-10-27', bucketId: '2050', globalPosition: 15 },
        // 370 starts on the 27th; its first snapshot credits the full gain.
        { day: '2026-10-27', bucketId: '370', globalPosition: 3 },
      ],
    )

    expect(usage.get('2026-10-26')).toEqual({ words: 10, feedSeconds: 60, appSeconds: 120 })
    expect(usage.get('2026-10-27')).toEqual({ words: 8, feedSeconds: 30, appSeconds: 90 })
  })

  it('never counts a lower snapshot as negative', () => {
    const usage = computeDailyUsage(
      [],
      [
        { day: '2026-10-26', bucketId: '2050', globalPosition: 100 },
        { day: '2026-10-27', bucketId: '2050', globalPosition: 40 },
      ],
    )
    expect(usage.get('2026-10-27')?.words).toBe(0)
  })
})
