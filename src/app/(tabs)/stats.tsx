import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/context';
import { fontSize } from '@/theme/tokens';

export default function StatsScreen() {
  const { colors } = useTheme();

  return (
    <Screen style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>Stats</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>Daily activity and round history</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  caption: {
    fontSize: fontSize.caption,
    marginTop: 8,
  },
});
