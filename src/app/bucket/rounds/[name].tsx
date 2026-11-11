import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { ListHeader } from '@/components/header'
import { ROUND_COLORS, RoundBar } from '@/components/round-bar'
import { getRoundsByBucket, type RoundRow } from '@/db/repo/study-round'
import { goBack } from '@/lib/back'
import { roundStatuses } from '@/lib/round-status'
import { formatSpan, formatStamp } from '@/lib/round-time'

/**
 * The round list of one bucket: every round the probe has entered, newest
 * first — its state, its red/green/gray sweep, and for a finished round when
 * it ran and how long it took.
 *
 * Tapping a round opens its flag list as a review walk — the marks that
 * round left are exactly what the review screen queues up.
 */
export default function RoundsScreen() {
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const activeName = useAtomValue(activeBucketAtom)
  // null = the database has not answered yet; an empty array would flash an
  // empty list first.
  const [rows, setRows] = useState<RoundRow[] | null>(null)
  const [exists, setExists] = useState(true)

  // Reloads on every focus: studying this bucket in the deck moves the probe
  // and eventually adds a round, and coming back here must show it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          const [found, summaries] = await getRoundsByBucket(bucketName)
          if (!cancelled) {
            setExists(found)
            setRows(summaries)
          }
        } catch (error) {
          console.error('[rounds] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName]),
  )

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader title={exists ? bucketName : undefined} onBack={goBack} />

      {!exists ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Bucket not found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: 24, padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {rows?.map((row) => (
            <RoundItem
              key={row.round}
              row={row}
              studying={bucketName === activeName}
              bucketName={bucketName}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function RoundItem({
  row,
  studying,
  bucketName,
}: {
  row: RoundRow
  studying: boolean
  bucketName: string
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const when = timeLineOf(row)
  const statuses = roundStatuses(row.wordCount, row)
  const green = statuses.filter((status) => status === 'green').length
  const red = statuses.filter((status) => status === 'red').length

  return (
    <View>
      <View className="gap-1 flex-row items-center">
        <Text className="font-semibold text-black dark:text-white text-[15px]">
          Round {row.round}
        </Text>
        <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
          · {labelOf(row, studying)}
        </Text>
      </View>
      <View className="mt-2">
        <RoundBar statuses={statuses} />
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        {/* The legend counts the same statuses the bar paints: a flagged card
            is red and no longer green, so the two never double-count it. The
            review count rides along: the round's walks so far, or the open
            draft that re-entering would resume. */}
        <View className="gap-4 flex-row items-center">
          <CountDot color={ROUND_COLORS[scheme].green} value={`${green} / ${row.wordCount}`} />
          <Pressable
            hitSlop={12}
            disabled={red === 0}
            accessibilityRole="button"
            accessibilityLabel={`Review round ${row.round} · ${red} flagged`}
            onPress={() =>
              router.push({
                pathname: '/mode/review',
                params: { bucket: bucketName, round: String(row.round) },
              })
            }
          >
            <CountDot color={ROUND_COLORS[scheme].red} value={String(red)} />
          </Pressable>
          {row.reviewTimes > 0 ? (
            <Text className="font-semibold text-blue-500 text-[13px]">T{row.reviewTimes}</Text>
          ) : (
            // A done round's draft is doomed (抹零 on re-entry): it counts as
            // nothing rather than promising a walk that will not happen.
            !row.done &&
            row.hasDraft && (
              <Text className="text-gray-400 dark:text-gray-500 text-[13px]">
                {`T${row.reviewTimes + 1} · uncounted`}
              </Text>
            )
          )}
        </View>
        {when && (
          <Text
            className="text-gray-400 dark:text-gray-500 text-[12px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {when}
          </Text>
        )}
      </View>
    </View>
  )
}

function CountDot({ color, value }: { color: string; value: string }) {
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

/** "complete" once the probe moved past it; otherwise whether this bucket is
 * the one being studied right now. A round with no stamp behind it has not
 * been entered yet, which reads differently from an idle one. */
function labelOf(row: RoundRow, studying: boolean): string {
  if (row.done) return 'complete'
  if (row.startedAt === 0) return 'not started'
  return studying ? 'studying' : 'idle'
}

/** The row's time line: a finished round's span (start · duration), or when
 * the live one began. A round with no stamp shows nothing rather than a
 * made-up time. */
function timeLineOf(row: RoundRow): string | null {
  if (row.startedAt <= 0) return null
  if (!row.done) return `started ${formatStamp(row.startedAt)}`
  return `${formatStamp(row.startedAt)} · ${formatSpan(row.startedAt, row.endedAt ?? 0)}`
}
