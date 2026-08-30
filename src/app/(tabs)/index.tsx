import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/context';
import { fontSize } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors } = useTheme();

  return (
    <Screen style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>Home</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>Current bucket and round progress</Text>
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
