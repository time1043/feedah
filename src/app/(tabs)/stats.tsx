import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Heatmap } from '@/components/heatmap';
import { RoundBar, type RoundWordStatus } from '@/components/round-bar';
import { Screen } from '@/components/screen';
import {
  getProgress,
  getRoundHistory,
  getRoundWords,
  getWordCount,
  listBuckets,
  listDailyPointers,
  listDailyStats,
} from '@/db/repo';
import { useSettings } from '@/db/settings';
import { computeDailyUsage, type DailyUsage } from '@/lib/daily';
import { todayLocalDate } from '@/lib/date';
import { formatDayLabel, formatMinutes } from '@/lib/format';
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
  green: number;
  red: number;
};

const WORD_THRESHOLDS: [number, number, number] = [10, 30, 100];
const MINUTE_THRESHOLDS: [number, number, number] = [10, 30, 60];

function countOf(statuses: RoundWordStatus[], status: RoundWordStatus): number {
  return statuses.reduce((total, s) => (s === status ? total + 1 : total), 0);
}

async function loadRounds(bucketId: string): Promise<RoundDisplay[]> {
  const [wordCount, history, progress] = await Promise.all([
    getWordCount(bucketId),
    getRoundHistory(bucketId),
    getProgress(bucketId),
  ]);
  const now = Date.now();
  const displays: RoundDisplay[] = [];

  for (const row of history) {
    const statuses = toStatuses(await getRoundWords(bucketId, row.round), wordCount);
    displays.push({
      round: row.round,
      statuses,
      days: Math.max(1, Math.ceil((row.finishedAt - row.startedAt) / 86_400_000)),
      done: true,
      pointer: wordCount,
      wordCount,
      green: countOf(statuses, 'green'),
      red: countOf(statuses, 'red'),
    });
  }

  const currentStatuses = toStatuses(await getRoundWords(bucketId, progress.round), wordCount);
  displays.push({
    round: progress.round,
    statuses: currentStatuses,
    days: progress.startedAt > 0 ? Math.max(1, Math.ceil((now - progress.startedAt) / 86_400_000)) : 0,
    done: progress.pointer >= wordCount,
    pointer: progress.pointer,
    wordCount,
    green: countOf(currentStatuses, 'green'),
    red: countOf(currentStatuses, 'red'),
  });
  return displays;
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

export default function StatsScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [usage, setUsage] = useState<Map<string, DailyUsage>>(new Map());
  const [metric, setMetric] = useState<Metric>('words');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(() => todayLocalDate());
  // Round tabs: only buckets that have been started appear here.
  const [roundTabs, setRoundTabs] = useState<string[]>([]);
  const [roundTab, setRoundTab] = useState('');
  const [rounds, setRounds] = useState<RoundDisplay[]>([]);

  useFocusEffect(() => {
    void (async () => {
      const [stats, pointers, buckets] = await Promise.all([
        listDailyStats(),
        listDailyPointers(),
        listBuckets(),
      ]);
      setUsage(computeDailyUsage(stats, pointers));

      const active = settings.activeBucketId;
      const tabs: string[] = [];
      for (const bucket of buckets) {
        const [progress, history] = await Promise.all([
          getProgress(bucket.id),
          getRoundHistory(bucket.id),
        ]);
        if (progress.pointer > 0 || progress.round > 1 || history.length > 0) {
          tabs.push(bucket.id);
        }
      }
      setRoundTabs(tabs);
      const tab = tabs.includes(active) ? active : (tabs[0] ?? '');
      setRoundTab(tab);
      setRounds(tab === '' ? [] : await loadRounds(tab));
    })();
  });

  const selectRoundTab = (id: string) => {
    if (id === roundTab) return;
    setRoundTab(id);
    void loadRounds(id).then(setRounds);
  };

  const today = usage.get(todayLocalDate());
  const dayUsage = usage.get(selectedDay);
  const isToday = selectedDay === todayLocalDate();
  const heatValues = new Map<string, number>();
  for (const [day, value] of usage) {
    heatValues.set(day, metric === 'words' ? value.words : Math.round(value.feedSeconds / 60));
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.todayCard}>
          <Text style={[styles.dayTitle, { color: colors.textTertiary }]}>
            {formatDayLabel(selectedDay)}
            {isToday ? ' · today' : ''}
          </Text>
          <View style={styles.today}>
            <StatBlock
              label="Words"
              value={`${dayUsage?.words ?? 0}`}
              onPress={
                dayUsage && dayUsage.words > 0
                  ? () => router.push(`/review?day=${selectedDay}`)
                  : undefined
              }
            />
            <StatBlock label="Studying" value={formatMinutes(dayUsage?.feedSeconds ?? 0)} />
            <StatBlock label="In app" value={formatMinutes(dayUsage?.appSeconds ?? 0)} />
          </View>
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
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </View>

        <View style={styles.rounds}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Rounds</Text>
          {roundTabs.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textTertiary }]}>No rounds yet — start studying first.</Text>
          ) : (
            <>
              <View style={styles.toggle}>
                {roundTabs.map((id) => (
                  <MetricPill key={id} label={id} active={id === roundTab} onPress={() => selectRoundTab(id)} />
                ))}
              </View>
              {rounds.map((round) => (
                <View key={round.round} style={styles.roundItem}>
                  <View style={styles.roundHead}>
                    <Text style={[styles.roundLabel, { color: colors.textTertiary }]}>
                      {`Round ${round.round} · ${round.done ? `${round.days}d` : `day ${round.days || 1}`} · ${round.pointer}/${round.wordCount}`}
                    </Text>
                  <View style={styles.roundCounts}>
                    <View style={styles.countGroup}>
                      <View style={[styles.countDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.roundCount, { color: colors.textSecondary }]}>{round.green}</Text>
                    </View>
                    <Pressable
                      disabled={round.red === 0}
                      onPress={() => router.push(`/review?bucket=${roundTab}&round=${round.round}`)}
                      style={styles.countGroup}>
                      <View style={[styles.countDot, { backgroundColor: colors.danger }]} />
                      <Text style={[styles.roundCount, { color: colors.textSecondary }]}>{round.red}</Text>
                    </Pressable>
                  </View>
                  </View>
                  <RoundBar statuses={round.statuses} />
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatBlock({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />}
      </View>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.statBlock}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.statBlock}>{content}</View>;
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
  todayCard: {
    gap: spacing.xs,
  },
  dayTitle: {
    fontSize: fontSize.caption,
    fontWeight: '600',
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
  statValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
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
  empty: {
    fontSize: fontSize.body,
  },
  roundItem: {
    gap: spacing.xs,
  },
  roundHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundLabel: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  roundCounts: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
  },
  countGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  countDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  roundCount: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    marginRight: spacing.xs,
  },
});
