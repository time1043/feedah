import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/context';
import { fontSize } from '@/theme/tokens';

export default function SettingsScreen() {
  const { colors } = useTheme();

  return (
    <Screen style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>App preferences</Text>
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
