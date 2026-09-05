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
  ipa?: string;
  flagged: boolean;
  /** Cards start with the meaning revealed when the user opted in. */
  defaultMeaningVisible?: boolean;
  onReplay: () => void;
  onToggleFlagged: () => void;
};

/**
 * The full-screen word card, split into two independent halves so toggling
 * the meaning never shifts anything:
 *   - top: position number, the word, and a fixed-height slot for the meaning
 *   - bottom: supplementary word forms, shown together with the meaning
 * Tap the word to replay it; tap anywhere else to reveal/hide the meaning;
 * tap the bookmark to flag the word as unfamiliar.
 */
export function WordCard({
  position,
  text,
  meaning,
  forms,
  ipa,
  flagged,
  defaultMeaningVisible = false,
  onReplay,
  onToggleFlagged,
}: WordCardProps) {
  const { colors } = useTheme();
  const [meaningVisible, setMeaningVisible] = useState(defaultMeaningVisible);
  const toggleMeaning = () => setMeaningVisible((v) => !v);

  return (
    <View style={styles.root}>
      <Pressable style={styles.top} onPress={toggleMeaning}>
        <Text style={[styles.position, { color: colors.textSecondary }]}>{position}</Text>
        <Pressable onPress={onReplay} hitSlop={12}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            numberOfLines={1}
            style={[styles.word, { color: colors.text }]}>
            {text}
          </Text>
        </Pressable>
        {ipa && ipa.length > 0 && (
          <Text style={[styles.ipa, { color: colors.textTertiary }]}>{ipa}</Text>
        )}
        {/* Reserved slot: keeps number and word anchored while meaning toggles. */}
        <View style={styles.meaningSlot}>
          {meaningVisible && meaning.length > 0 && (
            <Text style={[styles.meaning, { color: colors.textSecondary }]}>{meaning}</Text>
          )}
        </View>
      </Pressable>

      <Pressable style={styles.bottom} onPress={toggleMeaning}>
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
  top: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  bottom: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  position: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginBottom: spacing.m,
  },
  word: {
    fontSize: fontSize.word,
    fontWeight: '800',
    textAlign: 'center',
  },
  ipa: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: spacing.s,
  },
  meaningSlot: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'flex-start',
    marginTop: spacing.m,
  },
  meaning: {
    fontSize: 20,
    textAlign: 'center',
  },
  forms: {
    fontSize: fontSize.body,
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
