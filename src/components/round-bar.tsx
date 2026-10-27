import { useState } from 'react'
import { View, useColorScheme } from 'react-native'

export type RoundWordStatus = 'green' | 'red' | 'gray'

type RoundBarProps = {
  /** One entry per word in bucket order. */
  statuses: RoundWordStatus[]
}

const PALETTE = {
  light: { green: '#3D9A50', red: '#E5484D', gray: '#D9D9DE' },
  dark: { green: '#5BB96F', red: '#F0666B', gray: '#3A3D42' },
} as const

/**
 * Horizontal timeline of a round, drawn with plain views. Words are
 * aggregated into one two-pixel column (red wins over green over gray): a
 * 2000-word bucket cannot be resolved per word on a ~360dp bar, and one
 * column per two pixels keeps the draw cheap and every red word visible.
 */
export function RoundBar({ statuses }: RoundBarProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const [width, setWidth] = useState(0)

  const columns: RoundWordStatus[] = []
  if (width > 0 && statuses.length > 0) {
    const pixelCount = Math.min(statuses.length, Math.round(width / 2))
    const groupSize = statuses.length / pixelCount
    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const start = Math.floor(pixel * groupSize)
      const end =
        pixel === pixelCount - 1
          ? statuses.length
          : Math.min(statuses.length, Math.floor((pixel + 1) * groupSize))
      let column: RoundWordStatus = 'gray'
      for (let i = start; i < end; i++) {
        if (statuses[i] === 'red') {
          column = 'red'
          break
        }
        if (statuses[i] === 'green') column = 'green'
      }
      columns.push(column)
    }
  }

  const colors = PALETTE[scheme]
  const colorOf = (status: RoundWordStatus) =>
    status === 'red' ? colors.red : status === 'green' ? colors.green : colors.gray

  return (
    <View
      className="h-3.5 rounded-sm flex-row overflow-hidden"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {columns.map((column, index) => (
        <View key={index} style={{ backgroundColor: colorOf(column), flex: 1 }} />
      ))}
    </View>
  )
}
