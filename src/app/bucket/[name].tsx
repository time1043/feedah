import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RoundBar } from '@/components/round-bar'
import { formatYearMonthDay } from '@/lib/format'
import { buckets, findBucketByName } from '@/mock/data'
import { progressOf, roundFlagPositions, roundRecords } from '@/study/logic'
import { studyStateAtom } from '@/study/store'
import { activeBucketAtom } from '@/atoms/study'

const ICON = { light: '#9A9EA6', dark: '#7A7E86' }

/** The study routes this page can open, all carrying the bucket context. */
type ModeRoute = '/mode/feed' | '/mode/review' | '/mode/browse/[position]'

/**
 * One bucket's home: the three study modes for this bucket, and the record of
 * every round — start date, days spanned, and the green/red strip of what was
 * reached and what was flagged. Tapping a round reviews its flag list, the
 * way review derives from a round.
 */
export default function BucketDetailScreen() {
  const scheme: keyof typeof ICON = useColorScheme() === 'dark' ? 'dark' : 'light'
  const iconColor = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : (name ?? buckets[0].name)
  const bucket = findBucketByName(bucketName)
  const state = useAtomValue(studyStateAtom)
  const setActiveName = useSetAtom(activeBucketAtom)

  const progress = progressOf(state, bucketName)
  const currentFlags = roundFlagPositions(state, bucketName, progress.round)
  // Records are derived once per state change; "now" only feeds the running
  // round's day count.
  const records = roundRecords(state, {
    bucketId: bucketName,
    wordCount: bucket.words.length,
    now: Date.now(),
  })

  const open = <R extends ModeRoute>(pathname: R, params: Record<string, string> = {}) => {
    setActiveName(bucketName)
    // The generic keeps call sites to the three mode routes; the cast bridges
    // typed routes' per-route param shapes.
    router.push({ pathname, params: { ...params, bucket: bucketName } } as Href)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <View className="min-h-11 px-4 py-2 flex-row items-center">
        <Pressable className="w-8 items-start" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={ICON[scheme]} />
        </Pressable>
        <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
          {bucketName}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 24, paddingHorizontal: 16, paddingBottom: 32 }}
      >
        <View className="gap-2">
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">Mode</Text>
          <View className="gap-2">
            <ModeRow
              icon="play"
              title="Feed"
              detail={`round ${progress.round} · ${progress.pointer}/${bucket.words.length}`}
              onPress={() => open('/mode/feed', {})}
            />
            <ModeRow
              icon="bookmark"
              title="Review"
              detail={`round ${progress.round} · ${currentFlags.length} flagged`}
              disabled={currentFlags.length === 0}
              onPress={() =>
                open('/mode/review', { round: String(progress.round) })
              }
            />
            <ModeRow
              icon="compass"
              title="Browse"
              detail={`${bucket.words.length} words`}
              onPress={() => open('/mode/browse/[position]', { position: '1' })}
            />
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">Rounds</Text>
          <View className="gap-3">
            {records.map((record) => {
              const started = record.startedAt > 0
              return (
                <Pressable
                  key={record.round}
                  disabled={record.red === 0}
                  className="gap-2 rounded-2xl border-gray-200 p-3 dark:border-gray-800 disabled:opacity-60 border"
                  onPress={() =>
                    open('/mode/review', { round: String(record.round) })
                  }
                  accessibilityLabel={`Review round ${record.round} flags`}
                >
                  <Text
                    className="text-black dark:text-white text-[13px]"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    Round {record.round}
                    {started && ` · ${formatYearMonthDay(record.startedAt)}`}
                    {started && ` · ${record.days}d`}
                    {record.done ? '' : ' · in progress'}
                  </Text>
                  <RoundBar statuses={record.statuses} />
                  <View className="flex-row items-center justify-end gap-4">
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-1.5 w-1.5 rounded-full bg-[#3D9A50]" />
                      <Text
                        className="text-gray-500 dark:text-gray-400 text-[12px]"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {record.green}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-1.5 w-1.5 rounded-full bg-[#E5484D]" />
                      <Text
                        className="text-gray-500 dark:text-gray-400 text-[12px]"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {record.red}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ModeRow({
  icon,
  title,
  detail,
  onPress,
  disabled = false,
}: {
  icon: 'play' | 'bookmark' | 'compass'
  title: string
  detail: string
  onPress: () => void
  disabled?: boolean
}) {
  const scheme = useColorScheme() ?? 'light'
  return (
    <Pressable
      className="rounded-2xl border-gray-200 p-4 dark:border-gray-800 flex-row items-center gap-3 border disabled:opacity-50"
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={icon}
        size={20}
        color={scheme === 'dark' ? '#4CA0F0' : '#208AEF'}
      />
      <Text className="font-semibold text-black dark:text-white flex-1 text-[15px]">{title}</Text>
      <Text
        className="text-gray-500 dark:text-gray-400 text-[13px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {detail}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'} />
    </Pressable>
  )
}
