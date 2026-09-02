import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
import { getWord, setFlag, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { speakWord } from '@/lib/speech';
import { useTheme } from '@/theme/context';
import { spacing } from '@/theme/tokens';

/**
 * Single word card opened from search. Fully interactive (replay, reveal,
 * flag) but never counts as studying: it is a lookup, not a feed pass.
 */
export default function WordPage() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ position: string }>();
  const position = Number(params.position);
  const [word, setWord] = useState<WordRow | null>(null);

  useEffect(() => {
    if (!Number.isInteger(position) || position <= 0) return;
    let cancelled = false;
    void (async () => {
      const row = await getWord(settings.activeBucketId, position);
      if (cancelled) return;
      setWord(row);
      if (row && settings.autoPronounce) {
        speakWord(row.text, settings.speechRate);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Pronounce once on open; skip replay when settings change mid-view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, settings.activeBucketId]);

  const toggleFlagged = async () => {
    if (!word) return;
    const next = !word.flagged;
    await setFlag(settings.activeBucketId, word.position, next);
    setWord({ ...word, flagged: next });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Pressable
        style={styles.back}
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityLabel="Back">
        <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
      </Pressable>
      {word && (
        <View style={styles.card}>
          <WordCard
            position={word.position}
            text={word.text}
            meaning={word.meaning}
            forms={word.forms}
            flagged={word.flagged}
            onReplay={() => speakWord(word.text, settings.speechRate)}
            onToggleFlagged={() => void toggleFlagged()}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  back: {
    left: spacing.l,
    padding: spacing.s,
    position: 'absolute',
    top: spacing.s,
    zIndex: 1,
  },
  card: {
    flex: 1,
  },
});
