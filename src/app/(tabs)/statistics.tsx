import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { HeaderIconButton, TabHeader } from '@/components/header'
import { Heatmap } from '@/components/heatmap'
import { listDailyPointers, listDailyStats } from '@/db/repo'
import { computeDailyUsage, type DailyUsage } from '@/lib/daily'
import { todayLocalDate } from '@/lib/date'
import { formatDayLabel, formatMinutes } from '@/lib/format'

const WORD_THRESHOLDS: [number, number, number] = [10, 30, 100]
const MINUTE_THRESHOLDS: [number, number, number] = [10, 30, 60]
type Metric = 'words' | 'minutes'

/** Daily study statistics: a today readout, the year heatmap and its totals. */
export default function StatisticsScreen() {
  const [usage, setUsage] = useState<Map<string, DailyUsage>>(new Map())
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(() => todayLocalDate())
  const [metric, setMetric] = useState<Metric>('words')

  useFocusEffect(
    useCallback(() => {
      // Returning to the tab re-anchors to today: a browsed day is a
      // momentary readout.
      setSelectedDay(todayLocalDate())
      setYear(new Date().getFullYear())
      void (async () => {
        const [stats, pointers] = await Promise.all([listDailyStats(), listDailyPointers()])
        setUsage(computeDailyUsage(stats, pointers))
      })()
    }, []),
  )

  const dayUsage = usage.get(selectedDay)
  const isToday = selectedDay === todayLocalDate()

  const heatValues = new Map<string, number>()
  for (const [day, value] of usage) {
    heatValues.set(day, metric === 'words' ? value.words : Math.round(value.feedSeconds / 60))
  }

  // Year totals for the year the heatmap is showing, subordinate to the
  // selected day readout above.
  const yearPrefix = `${year}-`
  const yearTotals = { words: 0, feedSeconds: 0, appSeconds: 0 }
  for (const [day, value] of usage) {
    if (day.startsWith(yearPrefix)) {
      yearTotals.words += value.words
      yearTotals.feedSeconds += value.feedSeconds
      yearTotals.appSeconds += value.appSeconds
    }
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <TabHeader
        title="Statistics"
        right={
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
            {formatDayLabel(selectedDay)}
            {isToday ? ' · today' : ''}
          </Text>
        }
      />
      <ScrollView
        contentContainerStyle={{ gap: 24, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Today readout: words (tap = review the day) and the time split. */}
        <View className="gap-3 flex-row">
          <Pressable
            disabled={!dayUsage || dayUsage.words === 0}
            className="rounded-xl border-gray-300 py-3 dark:border-gray-700 flex-[1] items-center border disabled:opacity-40"
            onPress={() => router.push({ pathname: '/mode/review', params: { day: selectedDay } })}
          >
            <Text
              className="font-extrabold text-black dark:text-white text-[24px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {dayUsage?.words ?? 0}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-[13px]">words</Text>
          </Pressable>
          <View className="rounded-xl border-gray-300 py-3 dark:border-gray-700 flex-[2] items-center border">
            <Text
              className="font-extrabold text-black dark:text-white text-[24px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatMinutes(dayUsage?.feedSeconds ?? 0)}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
              studying / {formatMinutes(dayUsage?.appSeconds ?? 0)} in app
            </Text>
          </View>
        </View>

        <View className="gap-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
          <View className="flex-row items-center justify-between">
            <View className="gap-1 flex-row">
              <MetricPill
                label="Words"
                active={metric === 'words'}
                onPress={() => setMetric('words')}
              />
              <MetricPill
                label="Minutes"
                active={metric === 'minutes'}
                onPress={() => setMetric('minutes')}
              />
            </View>
            <View className="gap-1 flex-row items-center">
              <Pressable
                onPress={() => setYear((y) => y - 1)}
                hitSlop={8}
                accessibilityLabel="Previous year"
              >
                <Text className="px-2 text-gray-500 dark:text-gray-400 text-[17px]">‹</Text>
              </Pressable>
              <Text className="font-semibold text-black dark:text-white text-[15px]">{year}</Text>
              <Pressable
                onPress={() => setYear((y) => y + 1)}
                hitSlop={8}
                accessibilityLabel="Next year"
              >
                <Text className="px-2 text-gray-500 dark:text-gray-400 text-[17px]">›</Text>
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
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className="text-gray-400 dark:text-gray-500 text-[13px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {`${yearTotals.words} feed · ${formatMinutes(yearTotals.feedSeconds)} / ${formatMinutes(yearTotals.appSeconds)}`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
      onPress={onPress}
      className={`px-3 py-1 rounded-full ${active ? 'bg-blue-500' : 'bg-gray-100 dark:bg-gray-800'}`}
    >
      <Text
        className={`font-semibold text-[13px] ${
          active ? 'text-white' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
