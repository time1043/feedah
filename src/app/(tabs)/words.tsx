import { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { getWords, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';
import { useFocusEffect } from 'expo-router';

const ROW_HEIGHT = 52;

export default function WordsScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [words, setWords] = useState<WordRow[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<WordRow> | null>(null);

  useFocusEffect(() => {
    void getWords(settings.activeBucketId).then(setWords);
  });

  const jumpTo = (target: number) => {
    setIndex(target);
    listRef.current?.scrollToIndex({ index: target, animated: false });
  };

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min(words.length - 1, Math.round(offsetY / ROW_HEIGHT))));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.count, { color: colors.textTertiary }]}>
          {words.length} words
        </Text>
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
        renderItem={({ item }) => <Row word={item} />}
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
