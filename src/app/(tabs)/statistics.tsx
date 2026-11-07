import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { HeaderIconButton, TabHeader } from '@/components/header'
import { Heatmap } from '@/components/heatmap'
import { listDailyPointers, listDailyStats } from '@/db/repo'
import { aggregateMonths, computeDailyUsage, type DailyUsage } from '@/lib/daily'
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
    // Ceil: any studying at all must light the cell up — rounding a 40-second
    // session down to 0 would hide a study day from the calendar.
    heatValues.set(day, metric === 'words' ? value.words : Math.ceil(value.feedSeconds / 60))
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

  // Newest-first month ledger for the heatmap's selected year — switching
  // the year switches the ledger with it. Months without recorded days
  // don't exist.
  const months = aggregateMonths(usage).filter((month) => month.key.startsWith(`${year}-`))

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
        {/* Today readout: words (tap = review the day, long-press = review
            the day's flags) and the time split. */}
        <View className="gap-1">
          <View className="gap-3 flex-row">
            <Pressable
              className="rounded-xl border-gray-300 py-3 dark:border-gray-700 flex-[1] items-center border"
              onPress={() =>
                router.push({ pathname: '/mode/review', params: { day: selectedDay } })
              }
              onLongPress={() =>
                router.push({ pathname: '/mode/review', params: { flagDay: selectedDay } })
              }
              accessibilityLabel={`Review the words studied on ${selectedDay}, long-press for its flags`}
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
          <Text className="text-gray-400 dark:text-gray-500 text-[13px]">
            Long-press the words card to review the day's flags.
          </Text>
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

        {/* Month ledger: its own scroll region, so the heatmap above never
            scrolls away. Month titles pin while their totals slide under. */}
        {months.length > 0 && (
          <View className="gap-2 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
            <Text className="font-semibold text-black dark:text-white text-[15px]">Monthly</Text>
            <ScrollView
              style={{ maxHeight: 300 }}
              nestedScrollEnabled
              stickyHeaderIndices={months.map((_, index) => index * 2)}
              showsVerticalScrollIndicator={false}
            >
              {months.flatMap((month) => [
                <Text
                  key={`${month.key}-title`}
                  className="bg-white pb-1 dark:bg-black font-semibold text-black dark:text-white text-[15px]"
                >
                  {month.label}
                </Text>,
                <View
                  key={`${month.key}-totals`}
                  className="mb-2 rounded-xl border-gray-200 p-3 dark:border-gray-800 gap-3 flex-row items-center border"
                >
                  <Text
                    className="font-extrabold text-black dark:text-white min-w-[52px] text-right text-[20px]"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {month.words}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
                      words · {month.activeDays} {month.activeDays === 1 ? 'day' : 'days'}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
                      {formatMinutes(month.feedSeconds)} studying /{' '}
                      {formatMinutes(month.appSeconds)} in app
                    </Text>
                  </View>
                </View>,
              ])}
            </ScrollView>
          </View>
        )}
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
