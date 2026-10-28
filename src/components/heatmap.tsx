import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native'

import { todayLocalDate } from '@/lib/date'

type HeatmapProps = {
  year: number
  /** day (YYYY-MM-DD) -> value to colorize */
  values: Map<string, number>
  /** Three ascending cutoffs separating level 1..4; level 0 is empty. */
  thresholds: [number, number, number]
  /** Day highlighted with a border; the stats above follow it. */
  selectedDay?: string
  onSelectDay?: (day: string) => void
  cellSize?: number
}

const WEEKDAYS = 7
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LABEL_ROWS = [0, 1, 3, 5] // Sun, Mon, Wed, Fri — like GitHub
const GUTTER = 30

const TRACK = { light: '#D9D9DE', dark: '#3A3D42' }
// #3D9A50 (light) / #5BB96F (dark) as rgb triplets for alpha levels.
const SUCCESS = { light: '61, 154, 80', dark: '91, 185, 111' }
const LEVEL_ALPHAS = [0.35, 0.6, 0.8, 1]
const SELECTED = { light: '#208AEF', dark: '#4CA0F0' }

/** GitHub-style calendar heatmap for one year with month/weekday labels and
 * tappable cells. */
export function Heatmap({
  year,
  values,
  thresholds,
  selectedDay,
  onSelectDay,
  cellSize = 12,
}: HeatmapProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const gap = 2

  const weeks: (string | null)[][] = []
  const cursor = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)
  let week: (string | null)[] = Array.from({ length: cursor.getDay() }, () => null)
  while (cursor <= end) {
    week.push(todayLocalDate(cursor))
    if (week.length === WEEKDAYS) {
      weeks.push(week)
      week = []
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (week.length > 0) {
    weeks.push(week)
  }

  // Label a week column when its month differs from the previous labeled one.
  const monthLabels: (string | null)[] = []
  let lastMonth = -1
  for (const days of weeks) {
    const first = days.find((day): day is string => day !== null)
    if (!first) {
      monthLabels.push(null)
      continue
    }
    const month = Number(first.slice(5, 7)) - 1
    if (month !== lastMonth) {
      monthLabels.push(MONTHS[month])
      lastMonth = month
    } else {
      monthLabels.push(null)
    }
  }

  const levelOf = (value: number | undefined): number => {
    if (value === undefined || value <= 0) return 0
    if (value <= thresholds[0]) return 1
    if (value <= thresholds[1]) return 2
    if (value <= thresholds[2]) return 3
    return 4
  }

  const levelColor = (level: number): string => {
    if (level === 0) return TRACK[scheme]
    return `rgba(${SUCCESS[scheme]}, ${LEVEL_ALPHAS[level - 1]})`
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View
          style={[
            styles.monthRow,
            {
              height: 14,
              marginBottom: gap,
              width: GUTTER + weeks.length * (cellSize + gap),
            },
          ]}
        >
          {monthLabels.map((label, index) =>
            label ? (
              <Text
                key={index}
                style={[
                  styles.monthLabel,
                  { color: TRACK[scheme] === TRACK.light ? '#9A9EA6' : '#7A7E86', left: GUTTER + index * (cellSize + gap) },
                ]}
              >
                {label}
              </Text>
            ) : null,
          )}
        </View>
        <View style={{ flexDirection: 'row', gap }}>
          <View style={{ gap, width: GUTTER }}>
            {Array.from({ length: WEEKDAYS }, (_, row) =>
              LABEL_ROWS.includes(row) ? (
                <Text
                  key={row}
                  style={[
                    styles.weekdayLabel,
                    {
                      color: TRACK[scheme] === TRACK.light ? '#9A9EA6' : '#7A7E86',
                      height: cellSize,
                      lineHeight: cellSize,
                    },
                  ]}
                >
                  {WEEKDAY_LABELS[row]}
                </Text>
              ) : (
                <View key={row} style={{ height: cellSize }} />
              ),
            )}
          </View>
          <View style={[styles.row, { gap }]}>
            {weeks.map((days, weekIndex) => (
              <View key={weekIndex} style={{ gap }}>
                {days.map((day, dayIndex) => {
                  if (day === null) {
                    return <View key={`empty-${dayIndex}`} style={{ height: cellSize, width: cellSize }} />
                  }
                  const selected = day === selectedDay
                  return (
                    <Pressable
                      key={day}
                      onPress={() => onSelectDay?.(day)}
                      style={{
                        backgroundColor: levelColor(levelOf(values.get(day))),
                        borderColor: selected ? SELECTED[scheme] : 'transparent',
                        borderRadius: 2,
                        borderWidth: selected ? 1.5 : 0,
                        height: cellSize,
                        width: cellSize,
                      }}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  monthRow: { position: 'relative' },
  monthLabel: { fontSize: 9, position: 'absolute', top: 0 },
  weekdayLabel: { fontSize: 9, textAlign: 'right' },
})
