import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useIsFocused } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
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
  const { height } = useWindowDimensions();

  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [round, setRound] = useState(1);
  const [pointer, setPointer] = useState(0);
  const [current, setCurrent] = useState(0);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => (item.kind === 'word' ? `${item.word.position}` : 'round-end')}
        renderItem={({ item, index }) =>
          item.kind === 'word' ? (
            <View style={{ height }}>
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
            <View style={[styles.roundEnd, { height }]}>
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
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        initialScrollIndex={Math.min(current, items.length - 1)}
        onMomentumScrollEnd={(event) => {
          if (suppressSettle.current) {
            suppressSettle.current = false;
            return;
          }
          const index = Math.round(event.nativeEvent.contentOffset.y / height);
          const clamped = Math.max(0, Math.min(index, items.length - 1));
          void handleSettle(clamped);
        }}
      />

      <Pressable
        style={styles.back}
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityLabel="Close feed">
        <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
      </Pressable>
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
  back: {
    left: spacing.l,
    padding: spacing.s,
    position: 'absolute',
    top: spacing.s,
  },
});
