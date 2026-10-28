import { View, useColorScheme } from 'react-native'

import type { RoundWordStatus } from '@/study/types'

/** A 2050-word round cannot render one cell per word; aggregate into columns. */
const COLUMNS = 64

const COLORS: Record<RoundWordStatus, { light: string; dark: string }> = {
  green: { light: '#3D9A50', dark: '#5BB96F' },
  red: { light: '#E5484D', dark: '#F0666B' },
  gray: { light: '#D9D9DE', dark: '#3A3D42' },
}

/**
 * One round's word-by-word outcome as a thin horizontal strip: every column
 * stands for a slice of the bucket in position order, red winning over green
 * over gray so a single flagged word stays visible in its slice.
 */
export function RoundBar({ statuses }: { statuses: RoundWordStatus[] }) {
  const scheme: keyof typeof COLORS.green = useColorScheme() === 'dark' ? 'dark' : 'light'

  const columns: RoundWordStatus[] = []
  for (let column = 0; column < COLUMNS; column++) {
    const start = Math.floor((column * statuses.length) / COLUMNS)
    const end =
      column === COLUMNS - 1
        ? statuses.length
        : Math.floor(((column + 1) * statuses.length) / COLUMNS)
    let status: RoundWordStatus = 'gray'
    for (let i = start; i < end; i++) {
      if (statuses[i] === 'red') {
        status = 'red'
        break
      }
      if (statuses[i] === 'green') status = 'green'
    }
    columns.push(status)
  }

  return (
    <View className="h-3.5 rounded-sm flex-row gap-px overflow-hidden">
      {columns.map((status, index) => (
        <View
          key={index}
          className="h-full flex-1"
          style={{ backgroundColor: COLORS[status][scheme] }}
        />
      ))}
    </View>
  )
}
