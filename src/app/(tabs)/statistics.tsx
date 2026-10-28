import { router, useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Heatmap } from '@/components/heatmap'
import { todayLocalDate } from '@/lib/date'
import { formatDayLabel, formatMinutes } from '@/lib/format'
import { computeDailyUsage } from '@/study/logic'
import { studyStateAtom } from '@/study/store'

const WORD_THRESHOLDS: [number, number, number] = [10, 30, 100]
const MINUTE_THRESHOLDS: [number, number, number] = [10, 30, 60]

type Metric = 'words' | 'minutes'

/**
 * The year in study: a GitHub-style heatmap of daily activity with the
 * selected day's stats on top. Word counts come from the feed's watermark
 * snapshots (review never inflates them); minutes count focused study time.
 */
export default function StatisticsScreen() {
  const state = useAtomValue(studyStateAtom)
  const [metric, setMetric] = useState<Metric>('words')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(() => todayLocalDate())

  // Returning to the tab snaps back to today, like a fresh glance.
  useFocusEffect(
    useCallback(() => {
      setSelectedDay(todayLocalDate())
    }, []),
  )

  const usage = useMemo(() => (state ? computeDailyUsage(state) : null), [state])

  const values = useMemo(() => {
    const map = new Map<string, number>()
    if (!usage) return map
    for (const [day, dayUsage] of usage) {
      map.set(day, metric === 'words' ? dayUsage.words : Math.round(dayUsage.feedSeconds / 60))
    }
    return map
  }, [usage, metric])

  const yearTotals = useMemo(() => {
    let words = 0
    let feedSeconds = 0
    const prefix = `${year}-`
    for (const [day, dayUsage] of usage ?? []) {
      if (day.startsWith(prefix)) {
        words += dayUsage.words
        feedSeconds += dayUsage.feedSeconds
      }
    }
    return { words, feedSeconds }
  }, [usage, year])

  const dayUsage = usage?.get(selectedDay)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-black dark:text-white text-[22px]">Statistics</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
            {formatDayLabel(selectedDay)}
            {selectedDay === todayLocalDate() ? ' · today' : ''}
          </Text>
        </View>

        <View className="gap-2 flex-row">
          <StatChip
            value={String(dayUsage?.words ?? 0)}
            label="words"
            active={metric === 'words'}
            onPress={() => setMetric('words')}
          />
          <StatChip
            value={formatMinutes(dayUsage?.feedSeconds ?? 0)}
            label="studying"
            active={metric === 'minutes'}
            onPress={() => setMetric('minutes')}
          />
        </View>

        <View className="rounded-2xl border-gray-200 p-4 dark:border-gray-800 gap-3 border">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MetricPill label="Words" active={metric === 'words'} onPress={() => setMetric('words')} />
              <MetricPill
                label="Minutes"
                active={metric === 'minutes'}
                onPress={() => setMetric('minutes')}
              />
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable hitSlop={8} onPress={() => setYear((value) => value - 1)}>
                <Text className="text-gray-500 dark:text-gray-400 text-[17px]">‹</Text>
              </Pressable>
              <Text className="font-semibold text-black dark:text-white text-[15px]">{year}</Text>
              <Pressable hitSlop={8} onPress={() => setYear((value) => value + 1)}>
                <Text className="text-gray-500 dark:text-gray-400 text-[17px]">›</Text>
              </Pressable>
            </View>
          </View>

          <Heatmap
            year={year}
            values={values}
            thresholds={metric === 'words' ? WORD_THRESHOLDS : MINUTE_THRESHOLDS}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />

          <Text
            className="text-gray-400 dark:text-gray-500 text-[12px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {yearTotals.words} feed · {formatMinutes(yearTotals.feedSeconds)} studying
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatChip({
  value,
  label,
  active,
  onPress,
}: {
  value: string
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      className={`rounded-2xl border p-4 flex-1 ${active ? 'border-blue-500' : 'border-gray-200 dark:border-gray-800'}`}
      onPress={onPress}
    >
      <Text
        className="font-bold text-black dark:text-white text-[24px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-[12px]">{label}</Text>
    </Pressable>
  )
}

function MetricPill({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      className={`rounded-full px-3 py-1 ${active ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-800'}`}
      onPress={onPress}
    >
      <Text className={`text-[12px] ${active ? 'font-semibold text-white' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </Text>
    </Pressable>
  )
}
