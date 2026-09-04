import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { BucketTabs } from '@/components/bucket-tabs';
import { getWords, listBuckets, type Bucket, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

const ROW_HEIGHT = 52;

export default function WordsScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [tab, setTab] = useState('');
  const [words, setWords] = useState<WordRow[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<WordRow> | null>(null);

  useFocusEffect(() => {
    void (async () => {
      const list = await listBuckets();
      setBuckets(list);
      // Keep the current tab when valid; otherwise follow the active bucket.
      const target =
        tab && list.some((bucket) => bucket.id === tab)
          ? tab
          : (list.find((bucket) => bucket.id === settings.activeBucketId)?.id ?? list[0]?.id ?? '');
      setTab(target);
      if (target !== '') setWords(await getWords(target));
    })();
  });

  useEffect(() => {
    if (tab !== '') void getWords(tab).then(setWords);
  }, [tab]);

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
      </View>
      <View style={styles.jump}>
        <ProgressBar
          value={index}
          max={Math.max(words.length, 1)}
          interactive
          onScrub={jumpTo}
        />
      </View>
      <FlatList
        ref={listRef}
        data={words}
        keyExtractor={(word) => `${word.position}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/word/${item.position}?bucket=${tab}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Row word={item} />
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

function Row({ word }: { word: WordRow }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator, height: ROW_HEIGHT }]}>
      <Text style={[styles.position, { color: colors.textTertiary }]}>{word.position}</Text>
      {word.flagged && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
      <Text style={[styles.word, { color: colors.text }]} numberOfLines={1}>
        {word.text}
      </Text>
      <Text style={[styles.meaning, { color: colors.textSecondary }]} numberOfLines={1}>
        {word.meaning}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  meaning: {
    flex: 1,
    fontSize: 15,
  },
});
