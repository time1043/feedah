import { ScrollView, StyleSheet, View } from 'react-native';

import { withAlpha } from '@/lib/color';
import { todayLocalDate } from '@/lib/date';
import { useTheme } from '@/theme/context';

type HeatmapProps = {
  year: number;
  /** day (YYYY-MM-DD) -> value to colorize */
  values: Map<string, number>;
  /** Three ascending cutoffs separating level 1..4; level 0 is empty. */
  thresholds: [number, number, number];
  cellSize?: number;
};

const WEEKDAYS = 7;

/** GitHub-style calendar heatmap for one year, rendered as a view grid. */
export function Heatmap({ year, values, thresholds, cellSize = 12 }: HeatmapProps) {
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

  const levelOf = (value: number | undefined): number => {
    if (value === undefined || value <= 0) return 0;
    if (value <= thresholds[0]) return 1;
    if (value <= thresholds[1]) return 2;
    if (value <= thresholds[2]) return 3;
    return 4;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.row, { gap }]}>
        {weeks.map((days, weekIndex) => (
          <View key={weekIndex} style={{ gap }}>
            {days.map((day, dayIndex) => {
              if (day === null) {
                return <View key={`empty-${dayIndex}`} style={{ height: cellSize, width: cellSize }} />;
              }
              return (
                <View
                  key={day}
                  style={{
                    backgroundColor: levelColors[levelOf(values.get(day))],
                    borderRadius: 2,
                    height: cellSize,
                    width: cellSize,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
