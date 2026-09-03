import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useIsFocused } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
import { ProgressBar } from '@/components/progress-bar';
import {
  advancePointer,
  getProgress,
  getWords,
  setFlag,
  startNextRound,
  type WordRow,
} from '@/db/repo';
import { useSettings } from '@/db/settings';
import { flushUsage, pauseFeedUsage, startFeedUsage } from '@/db/usage';
import { speakWord } from '@/lib/speech';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

type FeedItem = { kind: 'word'; word: WordRow } | { kind: 'roundEnd' };

const FOOTER: FeedItem = { kind: 'roundEnd' };

/** Fullscreen swipe feed: one word card per page, immersive, no tab bar. */
export default function FeedScreen() {
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const router = useRouter();
  const isFocused = useIsFocused();

  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [round, setRound] = useState(1);
  const [pointer, setPointer] = useState(0);
  const [current, setCurrent] = useState(0);
  // Studying records; browsing (after a progress bar drag) records nothing.
  const [mode, setMode] = useState<'study' | 'browse'>('study');
  // Measured height of the scroll viewport. Cards must be exactly this tall,
  // otherwise pagingEnabled snapping drifts away from card boundaries.
  const [viewport, setViewport] = useState(0);

  const listRef = useRef<FlatList<FeedItem> | null>(null);
  const suppressSettle = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const progress = await getProgress(settings.activeBucketId);
      const list = await getWords(settings.activeBucketId);
      if (cancelled) return;
      setWords(list);
      setRound(progress.round);
      setPointer(progress.pointer);
      setCurrent(Math.min(progress.pointer, list.length));
      setMode('study');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.activeBucketId]);

  // Feed time accrues only while the screen is focused AND the app is
  // active; backgrounding pauses it, otherwise the whole background span
  // would be credited on the next tick.
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  useEffect(() => {
    if (isFocused) {
      startFeedUsage();
    } else {
      pauseFeedUsage();
      void flushUsage();
    }
    return () => {
      pauseFeedUsage();
    };
  }, [isFocused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (focusedRef.current) startFeedUsage();
      } else {
        pauseFeedUsage();
        void flushUsage();
      }
    });
    return () => subscription.remove();
  }, []);

  // Feed opens (and re-aligns whenever the viewport settles) exactly on a
  // card boundary, so a complete word is always shown.
  useEffect(() => {
    if (!ready || viewport <= 0) return;
    listRef.current?.scrollToIndex({ index: Math.min(current, items.length - 1), animated: false });
    // Re-align on layout changes only; current is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewport]);
  // One-time hint: iOS mutes speech while the ring/silent switch is on.
  useEffect(() => {
    if (!ready || !isFocused) return;
    if (Platform.OS === 'ios' && !settings.silentHintShown) {
      Alert.alert(
        'Sound',
        'Pronunciation stays silent when the ring/silent switch is on. Turn it off to hear the words.',
        [{ text: 'OK', onPress: () => update({ silentHintShown: true }) }],
      );
    }
  }, [ready, isFocused, settings.silentHintShown, update]);

  if (!ready) {
    return <View style={[styles.empty, { backgroundColor: colors.background }]} />;
  }

  const items: FeedItem[] = [...words.map((word) => ({ kind: 'word' as const, word })), FOOTER];

  const handleSettle = async (index: number) => {
    if (items[index]?.kind === 'roundEnd') {
      // The round-complete card: moving past it opens the next round.
      if (mode === 'study' && pointer >= words.length) {
        const next = await startNextRound(settings.activeBucketId);
        setRound(next.round);
        setPointer(0);
        setCurrent(0);
        suppressSettle.current = true;
        listRef.current?.scrollToIndex({ index: 0, animated: false });
      }
      return;
    }

    const position = index + 1;
    // Only studying mode records; browsing is free navigation.
    if (mode === 'study' && position > pointer) {
      const next = await advancePointer(settings.activeBucketId, position);
      setPointer(next.pointer);
    }
    setCurrent(index);
    if (settings.autoPronounce) {
      speakWord(words[index].text, settings.speechRate);
    }
    void flushUsage();
  };

  const toggleFlagged = async (index: number) => {
    const word = words[index];
    const next = !word.flagged;
    await setFlag(settings.activeBucketId, word.position, next);
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, flagged: next } : w)));
  };

  const jumpTo = (index: number) => {
    // Dragging the bar switches to browse mode: free navigation, zero
    // recording. Studying resumes from the frontier via the header control.
    suppressSettle.current = true;
    listRef.current?.scrollToIndex({ index, animated: false });
    setCurrent(index);
    setMode('browse');
  };

  const resumeStudy = () => {
    // Return to the first unlearned card; instant scroll so no settle fires.
    const target = Math.min(pointer, words.length);
    setMode('study');
    suppressSettle.current = true;
    listRef.current?.scrollToIndex({ index: target, animated: false });
    setCurrent(target);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Fixed header: progress bar row, then controls row; the card area
          always starts below it, so spacing stays constant. */}
      <View style={styles.header}>
        {settings.progressBar && (
          <View style={styles.progress}>
            <ProgressBar
              value={current}
              max={items.length}
              interactive={settings.progressBarDrag && pointer > 0}
              onScrub={jumpTo}
            />
          </View>
        )}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close feed">
            <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
          </Pressable>
          {mode === 'browse' && (
            <Pressable
              style={[styles.modePill, { backgroundColor: colors.accent }]}
              onPress={resumeStudy}>
              <Text style={styles.modePillText}>Resume studying</Text>
            </Pressable>
          )}
          {settings.feedSearch && (
            <Pressable onPress={() => router.push('/search')} hitSlop={12} accessibilityLabel="Search words">
              <Ionicons name="search" size={22} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View
        style={styles.listWrap}
        onLayout={(event) => {
          // Keep the exact fractional height: rounding would accumulate
          // sub-pixel drift between page snapping and item heights.
          const height = event.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - viewport) > 0.01) setViewport(height);
        }}>
        {viewport > 0 && (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => (item.kind === 'word' ? `${item.word.position}` : 'round-end')}
            renderItem={({ item, index }) =>
              item.kind === 'word' ? (
                <View style={{ height: viewport }}>
                  <WordCard
                    position={item.word.position}
                    text={item.word.text}
                    meaning={item.word.meaning}
                    forms={item.word.forms}
                    flagged={item.word.flagged}
                    onReplay={() => speakWord(item.word.text, settings.speechRate)}
                    onToggleFlagged={() => void toggleFlagged(index)}
                  />
                </View>
              ) : (
                <View style={[styles.roundEnd, { height: viewport }]}>
                  <Text style={[styles.roundEndTitle, { color: colors.text }]}>Round {round} complete</Text>
                  <Text style={[styles.roundEndHint, { color: colors.textTertiary }]}>
                    Swipe up to start round {round + 1}
                  </Text>
                </View>
              )
            }
            horizontal={false}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
            initialScrollIndex={Math.min(current, items.length - 1)}
            onMomentumScrollBegin={() => {
              // A real gesture is starting: drop any stale jump suppression
              // left behind by an instant scrollToIndex (which fires no events).
              suppressSettle.current = false;
            }}
            onMomentumScrollEnd={(event) => {
              if (suppressSettle.current) {
                suppressSettle.current = false;
                return;
              }
              const index = Math.round(event.nativeEvent.contentOffset.y / viewport);
              const clamped = Math.max(0, Math.min(index, items.length - 1));
              void handleSettle(clamped);
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
  empty: {
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
  modePill: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  modePillText: {
    color: '#FFFFFF',
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  listWrap: {
    flex: 1,
  },
  roundEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  roundEndTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  roundEndHint: {
    fontSize: fontSize.body,
  },
});
