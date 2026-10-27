import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { Pressable, Text, View } from 'react-native'

import { DEFAULT_PROGRESS, progressAtom } from '@/atoms/study'
import { buckets } from '@/mock/data'

/** The bucket list: one card per bucket, tap to open its word list. */
export default function BucketScreen() {
  const progress = useAtomValue(progressAtom)

  return (
    <View className="gap-3 bg-white p-4 dark:bg-black flex-1">
      <Text className="mb-1 font-bold text-black dark:text-white text-[22px]">Bucket</Text>
      {buckets.map((bucket) => {
        const { round, pointer } = progress[bucket.name] ?? DEFAULT_PROGRESS
        return (
          <Pressable
            key={bucket.name}
            className="rounded-2xl border-gray-300 p-4 dark:border-gray-700 border"
            onPress={() =>
              router.push({ pathname: '/words/[name]', params: { name: bucket.name } })
            }
          >
            <Text className="font-semibold text-black dark:text-white text-[17px]">
              {bucket.name}
            </Text>
            <Text
              className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              round {round} - {pointer}/{bucket.words.length}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
