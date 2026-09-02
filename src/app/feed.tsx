import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { fontSize, spacing } from '@/theme/tokens';

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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.activeBucketId]);

  // Feed time accrues only while the screen is focused; paused elsewhere.
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
      if (pointer >= words.length) {
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
    if (position > pointer) {
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
    suppressSettle.current = true;
    listRef.current?.scrollToIndex({ index, animated: false });
    setCurrent(index);
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
              maxIndex={pointer - 1}
              interactive={settings.progressBarDrag && pointer > 0}
              onScrub={jumpTo}
            />
          </View>
        )}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close feed">
            <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
          </Pressable>
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
          const height = Math.round(event.nativeEvent.layout.height);
          if (height > 0 && height !== viewport) setViewport(height);
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
