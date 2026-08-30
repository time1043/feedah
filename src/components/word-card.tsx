import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

type WordCardProps = {
  position: number;
  text: string;
  meaning: string;
  forms: string[];
  flagged: boolean;
  onReplay: () => void;
  onToggleFlagged: () => void;
};

/**
 * The full-screen word card. Tap the word to replay it, tap anywhere else to
 * reveal/hide the meaning, tap the bookmark to flag the word as unfamiliar.
 * Purely presentational: playback timing and statistics live in the screens.
 */
export function WordCard({ position, text, meaning, forms, flagged, onReplay, onToggleFlagged }: WordCardProps) {
  const { colors } = useTheme();
  const [meaningVisible, setMeaningVisible] = useState(false);

  return (
    <View style={styles.root}>
      <Pressable style={styles.center} onPress={() => setMeaningVisible((v) => !v)}>
        <Text style={[styles.position, { color: colors.textTertiary }]}>{position}</Text>
        <Pressable onPress={onReplay} hitSlop={12}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            numberOfLines={1}
            style={[styles.word, { color: colors.text }]}>
            {text}
          </Text>
        </Pressable>
        {meaningVisible && meaning.length > 0 && (
          <Text style={[styles.meaning, { color: colors.textSecondary }]}>{meaning}</Text>
        )}
        {meaningVisible && forms.length > 0 && (
          <Text style={[styles.forms, { color: colors.textTertiary }]}>{forms.join(', ')}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.flag}
        onPress={onToggleFlagged}
        hitSlop={16}
        accessibilityLabel={flagged ? 'Unflag word' : 'Flag word'}>
        <Ionicons
          name={flagged ? 'bookmark' : 'bookmark-outline'}
          size={30}
          color={flagged ? colors.danger : colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  position: {
    fontSize: fontSize.body,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.m,
  },
  word: {
    fontSize: fontSize.word,
    fontWeight: '800',
    textAlign: 'center',
  },
  meaning: {
    fontSize: 20,
    marginTop: spacing.l,
    textAlign: 'center',
  },
  forms: {
    fontSize: fontSize.caption,
    marginTop: spacing.s,
    textAlign: 'center',
  },
  flag: {
    alignItems: 'center',
    bottom: spacing.xl,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
