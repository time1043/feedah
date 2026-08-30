import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '@/components/screen';
import { getActiveBucketId, getProgress, getWordCount, listBuckets, setActiveBucketId, type Bucket, type Progress } from '@/db/repo';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors } = useTheme();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const load = async () => {
    const list = await listBuckets();
    const active = await getActiveBucketId();
    setBuckets(list);
    setActiveId(active);
    setProgress(await getProgress(active));
    setWordCount(await getWordCount(active));
  };

  useEffect(() => {
    void load();
  }, []);

  useFocusEffect(() => {
    void load();
  });

  const selectBucket = async (id: string) => {
    if (id === activeId) return;
    await setActiveBucketId(id);
    await load();
  };

  const round = progress?.round ?? 1;
  const pointer = progress?.pointer ?? 0;
  const started = pointer > 0 || round > 1;

  return (
    <Screen style={styles.root}>
      <View style={styles.chips}>
        {buckets.map((bucket) => {
          const active = bucket.id === activeId;
          return (
            <Pressable
              key={bucket.id}
              onPress={() => void selectBucket(bucket.id)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.accent : colors.surface },
              ]}>
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                {bucket.id}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.search, { backgroundColor: colors.surface }]}
        onPress={() => router.push('/search')}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <Text style={[styles.searchText, { color: colors.textTertiary }]}>Search words</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={[styles.round, { color: colors.textSecondary }]}>Round {round}</Text>
        <View style={styles.metricRow}>
          <Text style={[styles.metric, { color: colors.text }]}>{pointer}</Text>
          <Text style={[styles.metricTotal, { color: colors.textTertiary }]}> / {wordCount}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push('/feed')}>
          <Text style={styles.startText}>{started ? 'Continue' : 'Start'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  search: {
    alignItems: 'center',
    borderRadius: radius.l,
    flexDirection: 'row',
    gap: spacing.s,
    marginTop: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  searchText: {
    fontSize: fontSize.body,
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
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: spacing.m,
  },
  round: {
    fontSize: fontSize.body,
  },
  metricRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  metric: {
    fontSize: fontSize.metric,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  metricTotal: {
    fontSize: fontSize.title,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  start: {
    borderRadius: radius.l,
    marginTop: spacing.m,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
  },
  startText: {
    color: '#FFFFFF',
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});
