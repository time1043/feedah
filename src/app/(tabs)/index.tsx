import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '@/components/screen';
import { BucketTabs } from '@/components/bucket-tabs';
import {
  countFlaggedWords,
  getActiveBucketId,
  getProgress,
  getRoundFlagCounts,
  getWordCount,
  listBuckets,
  type Bucket,
  type Progress,
} from '@/db/repo';
import { useSettings } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { update } = useSettings();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [flagCounts, setFlagCounts] = useState({ green: 0, red: 0 });
  const [flaggedTotal, setFlaggedTotal] = useState(0);

  const load = async () => {
    const list = await listBuckets();
    if (list.length === 0) return; // DB not ready yet; the next focus retries
    // A stale/unknown meta value falls back to the first bucket (2050).
    const meta = await getActiveBucketId();
    const active = list.some((bucket) => bucket.id === meta) ? meta : list[0].id;
    setBuckets(list);
    setActiveId(active);
    setProgress(await getProgress(active));
    setWordCount(await getWordCount(active));
    setFlagCounts(await getRoundFlagCounts(active));
    setFlaggedTotal(await countFlaggedWords(active));
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useFocusEffect(() => {
    load().catch(() => {});
  });

  const selectBucket = (id: string) => {
    if (id === activeId) return;
    // The settings store is the single source of truth for the active bucket:
    // writing here keeps feed, search and the word page in sync immediately.
    update({ activeBucketId: id });
    setActiveId(id);
    void (async () => {
      setProgress(await getProgress(id));
      setWordCount(await getWordCount(id));
    })();
  };

  const round = progress?.round ?? 1;
  const pointer = progress?.pointer ?? 0;
  const started = pointer > 0 || round > 1;

  return (
    <Screen>
      <BucketTabs buckets={buckets} activeId={activeId} onSelect={selectBucket} />

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
        <View style={styles.flagRow}>
          <View style={styles.flagGroup}>
            <View style={[styles.flagDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.flagCount, { color: colors.textSecondary }]}>{flagCounts.green}</Text>
          </View>
          <Pressable
            disabled={flagCounts.red === 0}
            onPress={() => router.push(`/review?bucket=${activeId}&round=${round}`)}
            style={styles.flagGroup}>
            <View style={[styles.flagDot, { backgroundColor: colors.danger }]} />
            <Text
              style={[
                styles.flagCount,
                { color: flagCounts.red > 0 ? colors.danger : colors.textSecondary },
              ]}>
              {flagCounts.red}
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push(`/feed?bucket=${activeId}`)}>
          <Text style={styles.startText}>{started ? 'Continue' : 'Start'}</Text>
        </Pressable>
        <Pressable
          disabled={flaggedTotal === 0}
          style={({ pressed }) => [
            styles.review,
            { borderColor: colors.accent, opacity: flaggedTotal === 0 || pressed ? 0.4 : 1 },
          ]}
          onPress={() => router.push(`/review?bucket=${activeId}`)}>
          <Text style={[styles.reviewText, { color: colors.accent }]}>Review · {flaggedTotal}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    alignItems: 'center',
    borderRadius: radius.l,
    flexDirection: 'row',
    gap: spacing.s,
    marginHorizontal: spacing.m,
    marginTop: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  searchText: {
    fontSize: fontSize.body,
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
  flagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
  },
  flagGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
  },
  flagDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  flagCount: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    marginRight: spacing.xs,
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
  review: {
    borderRadius: radius.l,
    borderWidth: 1.5,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  reviewText: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});
