import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { getWords, listBuckets, type Bucket, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

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
      <View style={styles.tabs}>
        {buckets.map((bucket) => {
          const active = bucket.id === tab;
          return (
            <Pressable
              key={bucket.id}
              onPress={() => setTab(bucket.id)}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface }]}>
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                {bucket.id}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
      <Text style={[styles.forms, { color: colors.textTertiary }]} numberOfLines={1}>
        {word.forms.join(', ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
  },
  chip: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  chipText: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  header: {
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
    flex: 1.2,
    fontSize: 15,
    marginRight: spacing.s,
  },
  forms: {
    flex: 1,
    fontSize: fontSize.caption,
  },
});
