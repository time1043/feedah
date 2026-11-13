import { View, useColorScheme } from 'react-native'

import type { RoundWordStatus } from '@/lib/round-status'

import { FLAG_RED } from '@/lib/color'

/** The sweep's palette, shared with the round list's legend dots. The red is
 * the flag's own red, so a marked card and its legend agree. */
export const ROUND_COLORS = {
  light: { green: '#3D9A50', red: FLAG_RED.light, gray: '#D9D9DE' },
  dark: { green: '#5BB96F', red: FLAG_RED.dark, gray: '#3A3D42' },
} as const

type RoundBarProps = {
  /** One entry per word in bucket order. */
  statuses: RoundWordStatus[]
}

/**
 * Horizontal timeline of a round, drawn over a plain gray track. Runs of one
 * status merge into a single absolutely-positioned span — a finished round's
 * two thousand green words are one block, not one column per two pixels —
 * and every flagged run pins its own hairline at its words' exact position,
 * so a flag reads at word precision instead of the ~10-words-per-column the
 * old sweep averaged away. Percent positioning needs no width measurement,
 * and with dozens of views instead of hundreds, Android never rounds seams
 * between neighbors either.
 */
export function RoundBar({ statuses }: RoundBarProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const colors = ROUND_COLORS[scheme]
  const total = statuses.length

  // Merge same-status runs; gray stays on the track, green and red become
  // spans. The 1.5 min-width keeps a single word's span visible on a
  // two-thousand-word bar (where one word is a fraction of a percent).
  const spans: { start: number; count: number; status: RoundWordStatus }[] = []
  let index = 0
  while (index < total) {
    const status = statuses[index]
    let end = index + 1
    while (end < total && statuses[end] === status) end++
    if (status !== 'gray') spans.push({ start: index, count: end - index, status })
    index = end
  }

  return (
    <View className="h-3.5 rounded-sm overflow-hidden" style={{ backgroundColor: colors.gray }}>
      {spans.map((span) => (
        <View
          key={span.start}
          className="top-0 bottom-0 absolute"
          style={{
            left: `${(span.start / total) * 100}%`,
            width: `${(span.count / total) * 100}%`,
            minWidth: 1.5,
            backgroundColor: span.status === 'red' ? colors.red : colors.green,
          }}
        />
      ))}
    </View>
  )
}
