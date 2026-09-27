import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BucketTabs } from '@/components/bucket-tabs';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { getWords, getWordsCompletedOn, listBuckets, type Bucket, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { consumeDayJump } from '@/lib/day-jump';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

const ROW_HEIGHT = 52;

export default function WordsScreen() {
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tab, setTab] = useState('');
  const [words, setWords] = useState<WordRow[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<WordRow> | null>(null);
  const pendingJump = useRef(-1);

  useFocusEffect(() => {
    void (async () => {
      const list = await listBuckets();
      setBuckets(list);
      // A heatmap tap hands the day over: the list opens at that day's first
      // completed word, and the day-review's canonical bucket order decides
      // which tab shows it. Days without records change nothing.
      const day = consumeDayJump();
      const first = day ? ((await getWordsCompletedOn(day))[0] ?? null) : null;
      const target =
        first?.bucketId ??
        (tab && list.some((bucket) => bucket.id === tab)
          ? tab
          : (list.find((bucket) => bucket.id === settings.activeBucketId)?.id ??
            list[0]?.id ??
            ''));
      setTab(target);
      if (target !== '') setWords(await getWords(target));
      if (first) pendingJump.current = first.position - 1;
    })();
  });

  useEffect(() => {
    if (tab !== '') void getWords(tab).then(setWords);
  }, [tab]);

  // Consumes a heatmap handoff once the day's words are committed: scrolls
  // the list to that word, the readout following. Without a handoff the list
  // keeps whatever position the user left it at.
  useEffect(() => {
    const target = pendingJump.current;
    if (target < 0 || words.length === 0) return;
    pendingJump.current = -1;
    const targetIndex = Math.max(0, Math.min(words.length - 1, target));
    setIndex(targetIndex);
    listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
  }, [words]);

  const jumpTo = (target: number) => {
    setIndex(target);
    listRef.current?.scrollToIndex({ index: target, animated: false });
  };

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min(words.length - 1, Math.round(offsetY / ROW_HEIGHT))));
  };

  return (
    <Screen>
      <BucketTabs buckets={buckets} activeId={tab} onSelect={setTab} />
      <View style={styles.header}>
        <Text style={[styles.count, { color: colors.textTertiary }]}>{words.length} words</Text>
        <Pressable
          hitSlop={12}
          accessibilityLabel="Toggle meanings"
          onPress={() => update({ wordsMeaning: !settings.wordsMeaning })}
        >
          <Ionicons
            name={settings.wordsMeaning ? 'eye' : 'eye-off'}
            size={18}
            color={settings.wordsMeaning ? colors.accent : colors.textTertiary}
          />
        </Pressable>
      </View>
      <View style={styles.jump}>
        <ProgressBar value={index} max={Math.max(words.length, 1)} interactive onScrub={jumpTo} />
      </View>
      <FlatList
        ref={listRef}
        data={words}
        keyExtractor={(word) => `${word.position}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/word/${item.position}?bucket=${tab}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Row word={item} showMeaning={settings.wordsMeaning} />
          </Pressable>
        )}
        getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
        initialNumToRender={20}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
        style={{ backgroundColor: colors.background }}
      />
    </Screen>
  );
}

function Row({ word, showMeaning }: { word: WordRow; showMeaning: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator, height: ROW_HEIGHT }]}>
      <Text style={[styles.position, { color: colors.textTertiary }]}>{word.position}</Text>
      {word.flagged && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
      <Text
        style={[styles.word, { color: colors.text }, !showMeaning && styles.wordWide]}
        numberOfLines={1}
      >
        {word.text}
      </Text>
      {showMeaning && (
        <Text style={[styles.meaning, { color: colors.textSecondary }]} numberOfLines={1}>
          {word.meaning}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.m,
    paddingHorizontal: spacing.m,
  },
  count: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  jump: {
    paddingHorizontal: spacing.m,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.m,
  },
  position: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    width: 40,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  word: {
    flex: 1.1,
    fontSize: 15,
    fontWeight: '600',
    marginRight: spacing.s,
  },
  // With the meaning column hidden the word takes its place.
  wordWide: {
    flex: 2.1,
  },
  meaning: {
    flex: 1,
    fontSize: 15,
  },
});
