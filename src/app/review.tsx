import { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
import { ProgressBar } from '@/components/progress-bar';
import { getFlaggedWords, getRoundFlaggedWords, getWordsCompletedOn, setFlag, type WordRow } from '@/db/repo';
import { formatDayLabel } from '@/lib/format';
import { useSettings } from '@/db/settings';
import { flushUsage, pauseFeedUsage, startFeedUsage } from '@/db/usage';
import { speakWord } from '@/lib/speech';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

const FOOTER = { kind: 'end' as const };
type ReviewItem = { kind: 'word'; word: WordRow } | typeof FOOTER;

/**
 * Review pass: a session over the bucket's currently flagged words, in bucket
 * order. The queue is snapshotted on entry; unflagging during the session
 * updates the state but the word stays until the next pass. Nothing is
 * recorded — no pointer, no rounds, no word counts — though the time spent
 * counts as studying.
 */
export default function ReviewScreen() {
  const { colors } = useTheme();
  const { settings, ready: settingsReady } = useSettings();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ bucket?: string; round?: string; day?: string }>();
  const bucketId =
    typeof params.bucket === 'string' && params.bucket.length > 0
      ? params.bucket
      : settings.activeBucketId;
  // Flavor of the session: a round param targets the words flagged during
  // that round (snapshot); a day param targets the words completed on that
  // local day across buckets; without either it reviews the bucket's current
  // flag set.
  const round = Number(params.round);
  const hasRound = Number.isInteger(round) && round > 0;
  const day = typeof params.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : '';

  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState<WordRow[]>([]);
  const [current, setCurrent] = useState(0);
  const [viewport, setViewport] = useState(0);

  const listRef = useRef<FlatList<ReviewItem> | null>(null);
  const suppressSettle = useRef(false);

  useEffect(() => {
    if (!settingsReady) return;
    let cancelled = false;
    void (async () => {
      const list = hasRound
        ? await getRoundFlaggedWords(bucketId, round)
        : day !== ''
          ? await getWordsCompletedOn(day)
          : await getFlaggedWords(bucketId);
      if (cancelled) return;
      setQueue(list);
      setReady(true);
      if (settings.autoPronounce && list[0]) {
        speakWord(list[0].text, settings.speechRate);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsReady, bucketId, hasRound, round, day]);

  // Review time counts as studying: same tracking as the feed screen.
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

  // The end card lingers for two seconds before leaving the session.
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    [],
  );

  const handleSettle = (index: number) => {
    if (endTimer.current) return;
    if (index >= queue.length) {
      endTimer.current = setTimeout(() => {
        endTimer.current = null;
        router.back();
      }, 2000);
      return;
    }
    setCurrent(index);
    if (settings.autoPronounce) {
      speakWord(queue[index].text, settings.speechRate);
    }
    void flushUsage();
  };

  const toggleFlagged = async (index: number) => {
    const word = queue[index];
    if (!word) return;
    const next = !word.flagged;
    await setFlag(word.bucketId, word.position, next);
    setQueue((prev) => prev.map((w, i) => (i === index ? { ...w, flagged: next } : w)));
  };

  const jumpTo = (index: number) => {
    suppressSettle.current = true;
    listRef.current?.scrollToIndex({ index, animated: false });
    setCurrent(index);
  };

  if (ready && queue.length === 0) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            {day !== '' ? 'Nothing completed that day' : 'Nothing flagged yet'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // A day review may span several buckets; show them all in the title.
  const queueBuckets = [...new Set(queue.map((word) => word.bucketId))];

  const items: ReviewItem[] = [...queue.map((word) => ({ kind: 'word' as const, word })), FOOTER];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.progress}>
          <ProgressBar
            value={current}
            max={items.length}
            interactive
            onScrub={jumpTo}
          />
        </View>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close review">
            <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.textSecondary }]}>
            {hasRound ? `Review · Round ${round}` : day !== '' ? `Review · ${formatDayLabel(day)}` : 'Review'}
            {queueBuckets.length > 0 ? ` · ${queueBuckets.join('+')}` : ''}
          </Text>
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
            data={items}
            keyExtractor={(item) => (item.kind === 'word' ? `${item.word.position}` : 'review-end')}
            renderItem={({ item, index }) =>
              item.kind === 'word' ? (
                <View style={{ height: viewport }}>
                  <WordCard
                    position={item.word.position}
                    text={item.word.text}
                    meaning={item.word.meaning}
                    forms={item.word.forms}
                    ipa={item.word.ipa}
                    flagged={item.word.flagged}
                    defaultMeaningVisible={settings.showMeaning}
                    onReplay={() => speakWord(item.word.text, settings.speechRate)}
                    onToggleFlagged={() => void toggleFlagged(index)}
                  />
                </View>
              ) : (
                <View style={[styles.end, { height: viewport }]}>
                  <Text style={[styles.endTitle, { color: colors.text }]}>Review complete</Text>
                  <Text style={[styles.endHint, { color: colors.textTertiary }]}>
                    Swipe up to finish
                  </Text>
                </View>
              )
            }
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, index) => ({ length: viewport, offset: viewport * index, index })}
            onMomentumScrollBegin={() => {
              suppressSettle.current = false;
            }}
            onMomentumScrollEnd={(event) => {
              if (suppressSettle.current) {
                suppressSettle.current = false;
                return;
              }
              const index = Math.round(event.nativeEvent.contentOffset.y / viewport);
              const clamped = Math.max(0, Math.min(index, items.length - 1));
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
  title: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  listWrap: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.body,
  },
  end: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  endTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  endHint: {
    fontSize: fontSize.body,
  },
});
