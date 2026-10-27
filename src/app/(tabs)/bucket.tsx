import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { buckets } from '@/mock/data'
import { progressOf } from '@/study/logic'
import { studyStateAtom } from '@/study/store'

/**
 * The bucket list. One card per bucket with its live probe (current round and
 * how far it has flowed); the card body opens the bucket's round records,
 * the list icon opens its word list — two destinations on one card.
 */
export default function BucketScreen() {
  const scheme = useColorScheme() ?? 'light'
  const state = useAtomValue(studyStateAtom)

  return (
    <View className="gap-3 bg-white p-4 dark:bg-black flex-1">
      <Text className="mb-1 font-bold text-black dark:text-white text-[22px]">Bucket</Text>
      {buckets.map((bucket) => {
        const progress = progressOf(state, bucket.name)
        return (
          <Pressable
            key={bucket.name}
            className="rounded-2xl border-gray-300 p-4 dark:border-gray-700 flex-row items-center border"
            onPress={() => router.push({ pathname: '/bucket/[name]', params: { name: bucket.name } })}
          >
            <View className="flex-1">
              <Text className="font-semibold text-black dark:text-white text-[17px]">
                {bucket.name}
              </Text>
              <Text
                className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                round {progress.round} - {progress.pointer}/{bucket.words.length}
              </Text>
            </View>
            <Pressable
              className="p-2"
              hitSlop={8}
              accessibilityLabel={`Open word list of ${bucket.name}`}
              onPress={() =>
                router.push({ pathname: '/words/[name]', params: { name: bucket.name } })
              }
            >
              <Ionicons
                name="list"
                size={22}
                color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
              />
            </Pressable>
          </Pressable>
        )
      })}
    </View>
  )
}
