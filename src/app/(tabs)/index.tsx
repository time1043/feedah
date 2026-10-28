import { router } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { Pressable, Text, View } from 'react-native'

import ThemeToggle from '@/components/theme-toggle'
import { buckets, findBucketByName } from '@/mock/data'
import { progressOf, roundFlagPositions } from '@/study/logic'
import { activeBucketAtom } from '@/study/settings'
import { studyStateAtom } from '@/study/store'
import { EMPTY_STUDY_STATE } from '@/study/types'

export default function Index() {
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  // Reads update through hydration on their own; nothing here snapshots.
  const state = useAtomValue(studyStateAtom) ?? EMPTY_STUDY_STATE

  const bucket = findBucketByName(activeName)
  const progress = progressOf(state, activeName)
  const flaggedCount = roundFlagPositions(state, activeName, progress.round).length
  const started = progress.pointer > 0 || progress.round > 1

  return (
    <View className="gap-6 bg-white p-6 dark:bg-black flex-1 items-center justify-center">
      <ThemeToggle />

      <View className="max-w-sm gap-3 w-full">
        <View className="gap-2 flex-row">
          {buckets.map((entry) => (
            <Pressable
              key={entry.name}
              onPress={() => setActiveName(entry.name)}
              className={`rounded-lg p-3 flex-1 items-center border ${
                entry.name === activeName
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <Text className="text-black dark:text-white">{entry.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-gray-500 dark:text-gray-400 text-center text-[17px]">
          Round {progress.round}
        </Text>
        <Text
          className="font-extrabold text-black dark:text-white text-center text-[40px]"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {progress.pointer} / {bucket.words.length}
        </Text>

        <Pressable
          className="rounded-lg bg-blue-500 p-4 items-center"
          onPress={() => router.push('/mode/feed')}
        >
          <Text className="font-bold text-white">{started ? 'Continue' : 'Start'}</Text>
        </Pressable>

        <Pressable
          disabled={flaggedCount === 0}
          className="rounded-lg border-blue-500 p-3 items-center border-2 disabled:opacity-40"
          onPress={() =>
            router.push({ pathname: '/mode/review', params: { round: String(progress.round) } })
          }
        >
          <Text className="font-semibold text-blue-500">Review · {flaggedCount}</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 items-center border"
          onPress={() =>
            router.push({ pathname: '/mode/browse/[position]', params: { position: '1' } })
          }
        >
          <Text className="text-black dark:text-white">Browse from word 1</Text>
        </Pressable>
      </View>
    </View>
  )
}
