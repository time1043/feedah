import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
import { ProgressBar } from '@/components/progress-bar';
import { getWords, setFlag, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { speakWord } from '@/lib/speech';
import { useTheme } from '@/theme/context';
import { spacing } from '@/theme/tokens';

/**
 * Word browser opened from search: swipe up/down through the whole bucket,
 * scrub with the progress bar, flag words. Purely a lookup — none of it
 * counts as studying, moves the pointer, or records time.
 */
export default function WordPage() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ position: string; bucket?: string }>();
  const requested = Number(params.position);
  // The bucket is pinned by the opener (word list passes its tab); search
  // omits it and the active bucket is used.
  const bucketId =
    typeof params.bucket === 'string' && params.bucket.length > 0
      ? params.bucket
      : settings.activeBucketId;

  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [current, setCurrent] = useState(0);
  // Measured viewport height; cards must match it exactly for page snapping.
  const [viewport, setViewport] = useState(0);

  const listRef = useRef<FlatList<WordRow> | null>(null);
  const suppressSettle = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getWords(bucketId);
      if (cancelled) return;
      const initial =
        Number.isInteger(requested) && requested > 0 ? Math.min(requested, list.length) - 1 : 0;
      setWords(list);
      setCurrent(initial);
      setReady(true);
      if (settings.autoPronounce && list[initial]) {
        speakWord(list[initial].text, settings.speechRate);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bucketId, requested]);

  // Alignment insurance: whenever the layout settles, land exactly on a card.
  useEffect(() => {
    if (!ready || viewport <= 0) return;
    listRef.current?.scrollToIndex({ index: current, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewport]);

  const handleSettle = (index: number) => {
    setCurrent(index);
    if (settings.autoPronounce) {
      speakWord(words[index].text, settings.speechRate);
    }
  };

  const jumpTo = (index: number) => {
    suppressSettle.current = true;
    listRef.current?.scrollToIndex({ index, animated: false });
    setCurrent(index);
  };

  const toggleFlagged = async (index: number) => {
    const word = words[index];
    if (!word) return;
    const next = !word.flagged;
    await setFlag(bucketId, word.position, next);
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, flagged: next } : w)));
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {settings.wordProgressBar && (
          <View style={styles.progress}>
            <ProgressBar
              value={current}
              max={Math.max(words.length, 1)}
              interactive={settings.progressBarDrag}
              onScrub={jumpTo}
            />
          </View>
        )}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={() => router.push('/search')} hitSlop={12} accessibilityLabel="Search words">
            <Ionicons name="search" size={22} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View
        style={styles.listWrap}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - viewport) > 0.01) setViewport(height);
        }}>
        {ready && viewport > 0 && (
          <FlatList
            ref={listRef}
            data={words}
            keyExtractor={(word) => `${word.position}`}
            renderItem={({ item, index }) => (
              <View style={{ height: viewport }}>
                <WordCard
                  position={item.position}
                  text={item.text}
                  meaning={item.meaning}
                  forms={item.forms}
                  ipa={item.ipa}
                  flagged={item.flagged}
                  meaningMode={settings.meaningMode}
                  onReplay={() => speakWord(item.text, settings.speechRate)}
                  onToggleFlagged={() => void toggleFlagged(index)}
                />
              </View>
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
            initialScrollIndex={Math.min(current, words.length - 1)}
            onMomentumScrollBegin={() => {
              suppressSettle.current = false;
            }}
            onMomentumScrollEnd={(event) => {
              if (suppressSettle.current) {
                suppressSettle.current = false;
                return;
              }
              const index = Math.round(event.nativeEvent.contentOffset.y / viewport);
              const clamped = Math.max(0, Math.min(index, words.length - 1));
              handleSettle(clamped);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingBottom: spacing.s,
    paddingHorizontal: spacing.m,
  },
  progress: {
    paddingTop: spacing.xs,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
  },
  listWrap: {
    flex: 1,
  },
});
