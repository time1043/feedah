import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { Heatmap } from '@/components/heatmap';
import { RoundBar, type RoundWordStatus } from '@/components/round-bar';
import { Screen } from '@/components/screen';
import {
  getProgress,
  getRoundHistory,
  getRoundWords,
  getWordCount,
  listDailyPointers,
  listDailyStats,
} from '@/db/repo';
import { useSettings } from '@/db/settings';
import { computeDailyUsage, type DailyUsage } from '@/lib/daily';
import { formatMinutes } from '@/lib/format';
import { todayLocalDate } from '@/lib/date';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

type Metric = 'words' | 'minutes';

type RoundDisplay = {
  round: number;
  statuses: RoundWordStatus[];
  days: number;
  done: boolean;
  pointer: number;
  wordCount: number;
};

const WORD_THRESHOLDS: [number, number, number] = [10, 30, 100];
const MINUTE_THRESHOLDS: [number, number, number] = [10, 30, 60];

export default function StatsScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [usage, setUsage] = useState<Map<string, DailyUsage>>(new Map());
  const [metric, setMetric] = useState<Metric>('words');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [bucketId, setBucketId] = useState('');
  const [rounds, setRounds] = useState<RoundDisplay[]>([]);

  useFocusEffect(() => {
    void (async () => {
      const bucket = settings.activeBucketId;
      const [stats, pointers, wordCount, history, progress] = await Promise.all([
        listDailyStats(),
        listDailyPointers(),
        getWordCount(bucket),
        getRoundHistory(bucket),
        getProgress(bucket),
      ]);
      setBucketId(bucket);
      setUsage(computeDailyUsage(stats, pointers));

      const roundDisplays: RoundDisplay[] = [];
      const now = Date.now();
      for (const row of history) {
        const words = await getRoundWords(bucket, row.round);
        roundDisplays.push({
          round: row.round,
          statuses: toStatuses(words, wordCount),
          days: Math.max(1, Math.ceil((row.finishedAt - row.startedAt) / 86_400_000)),
          done: true,
          pointer: wordCount,
          wordCount,
        });
      }
      const currentWords = await getRoundWords(bucket, progress.round);
      roundDisplays.push({
        round: progress.round,
        statuses: toStatuses(currentWords, wordCount),
        days: progress.startedAt > 0 ? Math.max(1, Math.ceil((now - progress.startedAt) / 86_400_000)) : 0,
        done: progress.pointer >= wordCount,
        pointer: progress.pointer,
        wordCount,
      });
      setRounds(roundDisplays);
    })();
  });

  const today = usage.get(todayLocalDate());
  const heatValues = new Map<string, number>();
  for (const [day, value] of usage) {
    heatValues.set(day, metric === 'words' ? value.words : Math.round(value.feedSeconds / 60));
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.today}>
          <StatBlock label="Words today" value={`${today?.words ?? 0}`} />
          <StatBlock label="Studying" value={formatMinutes(today?.feedSeconds ?? 0)} />
          <StatBlock label="In app" value={formatMinutes(today?.appSeconds ?? 0)} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <View style={styles.toggle}>
              <MetricPill label="Words" active={metric === 'words'} onPress={() => setMetric('words')} />
              <MetricPill label="Minutes" active={metric === 'minutes'} onPress={() => setMetric('minutes')} />
            </View>
            <View style={styles.yearNav}>
              <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.year, { color: colors.text }]}>{year}</Text>
              <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
          <Heatmap
            year={year}
            values={heatValues}
            thresholds={metric === 'words' ? WORD_THRESHOLDS : MINUTE_THRESHOLDS}
          />
        </View>

        <View style={styles.rounds}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Rounds · {bucketId}</Text>
          {rounds.map((round) => (
            <View key={round.round} style={styles.roundItem}>
              <Text style={[styles.roundLabel, { color: colors.textTertiary }]}>
                {`Round ${round.round} · ${round.done ? `${round.days}d` : `day ${round.days || 1}`} · ${round.pointer}/${round.wordCount}`}
              </Text>
              <RoundBar statuses={round.statuses} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function toStatuses(
  words: { position: number; reached: boolean; flagged: boolean }[],
  wordCount: number,
): RoundWordStatus[] {
  const statuses: RoundWordStatus[] = Array.from({ length: wordCount }, () => 'gray');
  for (const word of words) {
    if (word.position < 1 || word.position > wordCount) continue;
    statuses[word.position - 1] = word.flagged ? 'red' : 'green';
  }
  return statuses;
}

function StatBlock({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function MetricPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: active ? colors.accent : colors.background }]}>
      <Text style={{ color: active ? '#FFFFFF' : colors.textSecondary, fontSize: fontSize.caption, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.l,
    padding: spacing.m,
  },
  today: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.title,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  statLabel: {
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  card: {
    borderRadius: radius.m,
    gap: spacing.m,
    padding: spacing.m,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggle: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  yearNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
  },
  year: {
    fontSize: fontSize.body,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
  rounds: {
    gap: spacing.m,
  },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  roundItem: {
    gap: spacing.xs,
  },
  roundLabel: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
});
