import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { fontSize } from '@/theme/tokens';

/** Fullscreen swipe feed. Pushed over the tab bar; immersive by design. */
export default function FeedScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Feed</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>Swipe feed screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
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
