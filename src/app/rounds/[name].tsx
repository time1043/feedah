import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RoundBar } from '@/components/round-bar'
import { getRoundSummaries, getWordCount, type RoundSummary } from '@/db/repo'
import { calendarDaysBetween } from '@/lib/date'
import { formatYearMonthDay } from '@/lib/format'
import { roundStatuses } from '@/lib/round-status'

/**
 * The round list of one bucket: every feed round with its start time,
 * duration and the red/green timeline of its words. Tapping a round opens a
 * review of that round's flag list.
 */
export default function RoundsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [wordCount, setWordCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const [summaries, count] = await Promise.all([
          getRoundSummaries(bucketName),
          getWordCount(bucketName),
        ])
        if (!cancelled) {
          setRounds(summaries)
          setWordCount(count)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName]),
  )

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <View className="min-h-11 px-4 py-2 flex-row items-center">
        <Pressable
          className="w-8 items-start"
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
          />
        </Pressable>
        <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
          {bucketName}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 24, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {rounds.map((round) => (
          <RoundRow key={round.round} round={round} wordCount={wordCount} bucketName={bucketName} />
        ))}
        {rounds.length === 0 && (
          <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
            No rounds yet — start studying first.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function RoundRow({
  round,
  wordCount,
  bucketName,
}: {
  round: RoundSummary
  wordCount: number
  bucketName: string
}) {
  const scheme = useColorScheme() ?? 'light'
  const statuses = roundStatuses(wordCount, round)
  const days = calendarDaysBetween(round.startedAt, round.finishedAt || Date.now())
  const started = round.startedAt > 0

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/mode/review',
          params: { bucket: bucketName, round: String(round.round) },
        })
      }
    >
      <Text className="font-semibold text-black dark:text-white text-[15px]">
        Round {round.round}
        {started ? ` · ${formatYearMonthDay(round.startedAt)} · ${days}d` : ' · not started yet'}
      </Text>
      <View className="mt-2">
        <RoundBar statuses={statuses} />
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <View className="gap-4 flex-row items-center">
          <CountDot color={scheme === 'dark' ? '#5BB96F' : '#3D9A50'} value={round.green} />
          <CountDot color={scheme === 'dark' ? '#F0666B' : '#E5484D'} value={round.red} />
        </View>
        {round.reviewTimes > 0 ? (
          <Text className="font-semibold text-blue-500 text-[13px]">time {round.reviewTimes}</Text>
        ) : round.hasDraft ? (
          <Text className="text-gray-400 dark:text-gray-500 text-[13px]">time 1 · uncounted</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function CountDot({ color, value }: { color: string; value: number }) {
  return (
    <View className="gap-1.5 flex-row items-center">
      <View className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text
        className="text-gray-500 dark:text-gray-400 text-[13px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  )
}
