import { Ionicons } from '@expo/vector-icons';
import { useRouter, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import {
  advancePointer,
  getBucket,
  getProgress,
  getWords,
  setFlag,
  startNextRound,
  type Bucket,
  type WordRow,
} from '@/db/repo';
import { useSettings } from '@/db/settings';
import { flushUsage, pauseFeedUsage, startFeedUsage } from '@/db/usage';
import { speakWord } from '@/lib/speech';
import { getMode, type ModeResult } from '@/modes';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

type FeedItem = { kind: 'word'; word: WordRow } | { kind: 'roundEnd' };

const FOOTER: FeedItem = { kind: 'roundEnd' };

/** Fullscreen swipe feed: one word card per page, immersive, no tab bar. */
export default function FeedScreen() {
  const { colors } = useTheme();
  const { settings, ready: settingsReady, update } = useSettings();
  const router = useRouter();
  const isFocused = useIsFocused();
  // Home pins the bucket on navigation; without the param the active bucket
  // from settings is used (only once settings have actually loaded).
  const params = useLocalSearchParams<{ bucket?: string }>();
  const bucketId =
    typeof params.bucket === 'string' && params.bucket.length > 0
      ? params.bucket
      : settings.activeBucketId;

  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [bucketMeta, setBucketMeta] = useState<Bucket | null>(null);
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
  // While the round-complete page lingers, gestures record nothing.
  const roundAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While an answered card lingers before the mode's auto-advance, a manual
  // swipe cancels the queued scroll.
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (roundAdvanceTimer.current) clearTimeout(roundAdvanceTimer.current);
      if (answerTimer.current) clearTimeout(answerTimer.current);
    },
    [],
  );

  useEffect(() => {
    // Wait for settings: before the meta table loads, activeBucketId is a
    // default and starting here would open the wrong bucket.
    if (!settingsReady) return;
    let cancelled = false;
    void (async () => {
      const progress = await getProgress(bucketId);
      const list = await getWords(bucketId);
      const meta = await getBucket(bucketId);
      if (cancelled) return;
      setWords(list);
      setBucketMeta(meta);
      setRound(progress.round);
      setPointer(progress.pointer);
      setCurrent(Math.min(progress.pointer, list.length));
      setMode('study');
      setReady(true);
      // Speak the card the feed opens on; other cards speak on settle.
      const initial = Math.min(progress.pointer, list.length);
      if (settings.autoPronounce && list[initial]) {
        speakWord(list[initial].text, settings.speechRate, meta?.language);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsReady, bucketId]);

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
  const plugin = getMode(settings.studyMode, bucketMeta?.kind ?? 'word');
  const bucketInfo = {
    id: bucketId,
    kind: bucketMeta?.kind ?? ('word' as const),
    language: bucketMeta?.language ?? 'en',
  };

  const handleSettle = async (index: number) => {
    // The round-complete page lingers for two seconds; gestures in that
    // window record nothing. A manual swipe also cancels a queued mode
    // auto-advance — the user took over navigation.
    if (roundAdvanceTimer.current) return;
    if (answerTimer.current) {
      clearTimeout(answerTimer.current);
      answerTimer.current = null;
    }
    // Studying counts the card you just LEFT BEHIND: landing on a card
    // completes the previous one, so the card on screen is still in progress
    // and exiting there loses nothing.
    if (items[index]?.kind === 'roundEnd') {
      // The footer is only reachable by swiping past the last card. The
      // `pointer === words.length` arm covers answer-driven modes: they
      // record the last card when it is answered, so the pointer already
      // sits at the full count when the footer settles.
      if (
        mode === 'study' &&
        pointer >= words.length - 1 &&
        (index > pointer || pointer === words.length)
      ) {
        setCurrent(index);
        const next = await advancePointer(bucketId, index);
        setPointer(next.pointer);
        if (next.pointer >= words.length) {
          const progress = await startNextRound(bucketId);
          setRound(progress.round);
          setPointer(progress.pointer);
          // Let the completion page linger, then open the new round.
          roundAdvanceTimer.current = setTimeout(() => {
            roundAdvanceTimer.current = null;
            suppressSettle.current = true;
            listRef.current?.scrollToIndex({ index: 0, animated: false });
            setCurrent(0);
          }, 2000);
        }
      }
      return;
    }

    // Only studying mode records; browsing is free navigation.
    if (mode === 'study' && index > pointer) {
      const next = await advancePointer(bucketId, index);
      setPointer(next.pointer);
    }
    setCurrent(index);
    if (settings.autoPronounce) {
      speakWord(words[index].text, settings.speechRate, bucketInfo.language);
    }
    void flushUsage();
  };

  /** Mode-reported result: record the answer, then let the card advance. */
  const handleResult = (index: number, result: ModeResult) => {
    if (result.kind !== 'answered') return;
    if (mode === 'study' && index + 1 > pointer) {
      void advancePointer(bucketId, index + 1, { correct: result.correct }).then((next) => {
        setPointer(next.pointer);
      });
    }
    if (plugin.autoAdvanceMs != null) {
      if (answerTimer.current) clearTimeout(answerTimer.current);
      answerTimer.current = setTimeout(() => {
        answerTimer.current = null;
        advanceFromCard(index);
      }, plugin.autoAdvanceMs);
    }
  };

  /** Card-initiated advance (mode auto-advance or a future Next button). */
  const advanceFromCard = (index: number) => {
    const target = Math.min(index + 1, items.length - 1);
    // Landing on the footer must still settle so the round can complete.
    suppressSettle.current = target < items.length - 1;
    listRef.current?.scrollToIndex({ index: target, animated: false });
    setCurrent(target);
    if (words[target] && settings.autoPronounce) {
      speakWord(words[target].text, settings.speechRate, bucketInfo.language);
    }
    void flushUsage();
  };

  const toggleFlagged = async (index: number) => {
    const word = words[index];
    const next = !word.flagged;
    await setFlag(bucketId, word.position, next);
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
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
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
              onPress={resumeStudy}
            >
              <Text style={styles.modePillText}>Resume studying</Text>
            </Pressable>
          )}
          {settings.feedSearch && (
            <Pressable
              onPress={() => router.push(`/search?bucket=${bucketId}`)}
              hitSlop={12}
              accessibilityLabel="Search words"
            >
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
        }}
      >
        {viewport > 0 && (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => (item.kind === 'word' ? `${item.word.position}` : 'round-end')}
            renderItem={({ item, index }) =>
              item.kind === 'word' ? (
                <View style={{ height: viewport }}>
                  <plugin.Card
                    item={item.word}
                    bucket={bucketInfo}
                    pool={words}
                    round={round}
                    settings={settings}
                    flagged={item.word.flagged}
                    onResult={(result) => handleResult(index, result)}
                    onToggleFlagged={() => void toggleFlagged(index)}
                    requestAdvance={() => advanceFromCard(index)}
                  />
                </View>
              ) : (
                <View style={[styles.roundEnd, { height: viewport }]}>
                  <Text style={[styles.roundEndTitle, { color: colors.text }]}>
                    Round {round} complete
                  </Text>
                  <Text style={[styles.roundEndHint, { color: colors.textTertiary }]}>
                    Round {round + 1} starts in a moment
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
