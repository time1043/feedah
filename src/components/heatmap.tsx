import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/lib/color';
import { todayLocalDate } from '@/lib/date';
import { useTheme } from '@/theme/context';

type HeatmapProps = {
  year: number;
  /** day (YYYY-MM-DD) -> value to colorize */
  values: Map<string, number>;
  /** Three ascending cutoffs separating level 1..4; level 0 is empty. */
  thresholds: [number, number, number];
  /** Day highlighted with a border; the stats above follow it. */
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  cellSize?: number;
};

const WEEKDAYS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABEL_ROWS = [0, 1, 3, 5]; // Sun, Mon, Wed, Fri — like GitHub
const GUTTER = 30;

/** GitHub-style calendar heatmap for one year with month/weekday labels and
 * tappable cells. */
export function Heatmap({ year, values, thresholds, selectedDay, onSelectDay, cellSize = 12 }: HeatmapProps) {
  const { colors } = useTheme();
  const gap = 2;
  const levelColors = [
    colors.track,
    withAlpha(colors.success, 0.35),
    withAlpha(colors.success, 0.6),
    withAlpha(colors.success, 0.8),
    colors.success,
  ];

  const weeks: (string | null)[][] = [];
  const cursor = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  let week: (string | null)[] = Array.from({ length: cursor.getDay() }, () => null);
  while (cursor <= end) {
    week.push(todayLocalDate(cursor));
    if (week.length === WEEKDAYS) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (week.length > 0) {
    weeks.push(week);
  }

  // Label a week column when its month differs from the previous labeled one.
  const monthLabels: (string | null)[] = [];
  let lastMonth = -1;
  for (const days of weeks) {
    const first = days.find((day): day is string => day !== null);
    if (!first) {
      monthLabels.push(null);
      continue;
    }
    const month = Number(first.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      monthLabels.push(MONTHS[month]);
      lastMonth = month;
    } else {
      monthLabels.push(null);
    }
  }

  const levelOf = (value: number | undefined): number => {
    if (value === undefined || value <= 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    return 4;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.monthRow, { height: 14, marginBottom: gap, width: GUTTER + weeks.length * (cellSize + gap) }]}>
          {monthLabels.map((label, index) =>
            label ? (
              <Text key={index} style={[styles.monthLabel, { color: colors.textTertiary, left: GUTTER + index * (cellSize + gap) }]}>
                {label}
              </Text>
            ) : null,
          )}
        </View>
        <View style={{ flexDirection: 'row', gap }}>
          <View style={{ gap, width: GUTTER }}>
            {Array.from({ length: WEEKDAYS }, (_, row) =>
              LABEL_ROWS.includes(row) ? (
                <Text key={row} style={[styles.weekdayLabel, { color: colors.textTertiary, height: cellSize, lineHeight: cellSize }]}>
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
                    return <View key={`empty-${dayIndex}`} style={{ height: cellSize, width: cellSize }} />;
                  }
                  const selected = day === selectedDay;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => onSelectDay?.(day)}
                      style={{
                        backgroundColor: levelColors[levelOf(values.get(day))],
                        borderColor: selected ? colors.accent : 'transparent',
                        borderRadius: 2,
                        borderWidth: selected ? 1.5 : 0,
                        height: cellSize,
                        width: cellSize,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  monthRow: {
    position: 'relative',
  },
  monthLabel: {
    fontSize: 9,
    position: 'absolute',
    top: 0,
  },
  weekdayLabel: {
    fontSize: 9,
    textAlign: 'right',
  },
});
