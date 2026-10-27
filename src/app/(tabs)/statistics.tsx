import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Heatmap } from '@/components/heatmap'
import { listDailyPointers, listDailyStats } from '@/db/repo'
import { computeDailyUsage, type DailyUsage } from '@/lib/daily'
import { todayLocalDate } from '@/lib/date'
import { formatDayLabel, formatMinutes } from '@/lib/format'

const WORD_THRESHOLDS: [number, number, number] = [10, 30, 100]

/** Daily study statistics: a today readout, the year heatmap and its totals. */
export default function StatisticsScreen() {
  const [usage, setUsage] = useState<Map<string, DailyUsage>>(new Map())
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(() => todayLocalDate())

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
    heatValues.set(day, value.words)
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
      <ScrollView
        contentContainerStyle={{ gap: 24, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-black dark:text-white text-[22px]">Statistics</Text>
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
            {formatDayLabel(selectedDay)}
            {isToday ? ' · today' : ''}
          </Text>
        </View>

        <View className="gap-3 flex-row">
          <View className="rounded-xl border-gray-300 py-3 dark:border-gray-700 flex-1 items-center border">
            <Text
              className="font-extrabold text-black dark:text-white text-[24px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {dayUsage?.words ?? 0}
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-[13px]">words</Text>
          </View>
          <View className="rounded-xl border-gray-300 py-3 dark:border-gray-700 flex-1 items-center border">
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
          <Heatmap
            year={year}
            values={heatValues}
            thresholds={WORD_THRESHOLDS}
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
