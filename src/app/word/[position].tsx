import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { WordCard } from '@/components/word-card';
import { getProgress, getWords, setFlag, type WordRow } from '@/db/repo';
import { isUnflagLocked, parseRoundParam } from '@/lib/flag-scope';
import { useSettings } from '@/db/settings';
import { requestSearchReset } from '@/lib/search-reset';
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
  const params = useLocalSearchParams<{
    position: string;
    bucket?: string;
    from?: string;
    round?: string;
  }>();
  const requested = Number(params.position);
  // The bucket is pinned by the opener (word list passes its tab); search
  // omits it and the active bucket is used.
  const bucketId =
    typeof params.bucket === 'string' && params.bucket.length > 0
      ? params.bucket
      : settings.activeBucketId;
  // Search results mark this page `from=search`; the search icon then returns
  // to that search instead of opening another one.
  const fromSearch = params.from === 'search';
  // The round context forwarded by the opener's search: flags here belong to
  // that round's list (search guards bucket match; without it this is the
  // home-search fallback and flags go to the current round).
  const contextRound = parseRoundParam(params.round);

  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [current, setCurrent] = useState(0);
  // Measured viewport height; cards must match it exactly for page snapping.
  const [viewport, setViewport] = useState(0);

  const listRef = useRef<FlatList<WordRow> | null>(null);
  const suppressSettle = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Card bookmarks show the context round's list membership (current
      // round on fallback surfaces): the toggle acts on that list.
      const [list, progress] = await Promise.all([
        getWords(bucketId, contextRound),
        getProgress(bucketId),
      ]);
      if (cancelled) return;
      const initial =
        Number.isInteger(requested) && requested > 0 ? Math.min(requested, list.length) - 1 : 0;
      setWords(list);
      setCurrentRound(progress.round);
      setCurrent(initial);
      setReady(true);
      if (settings.autoPronounce && list[initial]) {
        speakWord(list[initial].text, settings.speechRate);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bucketId, requested, contextRound]);

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
    // Past-round membership cannot be unflagged (append-only across sync);
    // the card disables the toggle — this guard is the backstop.
    if (isUnflagLocked(contextRound, currentRound, word.flagged)) return;
    const next = !word.flagged;
    await setFlag(bucketId, word.position, next, contextRound);
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, flagged: next } : w)));
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
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
          {/* Results open this page marked from=search, so the icon goes back
              to that search for a fresh lookup — bar cleared, keyboard up;
              the back gesture keeps the query. Other origins replace into a
              fresh search, so a word card never lingers beneath a search. */}
          <Pressable
            onPress={
              fromSearch
                ? () => {
                    requestSearchReset();
                    router.back();
                  }
                : () => router.replace('/search')
            }
            hitSlop={12}
            accessibilityLabel="Search words"
          >
            <Ionicons name="search" size={22} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View
        style={styles.listWrap}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0 && Math.abs(height - viewport) > 0.01) setViewport(height);
        }}
      >
        {!ready || viewport <= 0 ? (
          // The whole bucket loads before the first card can show — keep the
          // wait visible instead of a blank page.
          <View style={styles.loading}>
            <ActivityIndicator color={colors.textTertiary} />
          </View>
        ) : (
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
                  flagLocked={isUnflagLocked(contextRound, currentRound, item.flagged)}
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
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
